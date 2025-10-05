import nodemailer from "nodemailer";

export default async function handler(req, res) {
  const allowOrigin = process.env.CORS_ORIGIN || "*";

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const body = req.body || {};
  // Normalize fields from both forms
  const kind = body.form === "Kontakt" ? "Kontakt-Anfrage" : "Termin-Anfrage";
  const name = (body.name || "").toString().trim();
  const email = (body.email || "").toString().trim();
  const phone = (body.phone || body.telefon || "").toString().trim();
  const reason = (body.reason || body.concern || "").toString().trim();
  const notes  = (body.notes || body.message || body.nachricht || "").toString().trim();
  const dateHuman = (body.dateHuman || "").toString().trim();
  const timeHuman = (body.timeHuman || "").toString().trim();
  const tz = (body.tz || "").toString().trim();

  if (!name || !email) {
    return res.status(400).send("Feld fehlt oder leer: name/email");
  }
  // For booking, require date+time
  if (kind === "Termin-Anfrage" && (!dateHuman || !timeHuman)) {
    return res.status(400).send("Feld fehlt oder leer: date/time");
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.ionos.de",
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const recipients = (process.env.MAIL_TO || "Khieschman@mls-sv.de,hassan.awad@outlook.de")
      .split(/[;,]\s*/)
      .filter(Boolean);

    const html = `
      <h2>${escapeHtml(kind)}</h2>
      <p><b>Name:</b> ${escapeHtml(name)}</p>
      <p><b>E-Mail:</b> ${escapeHtml(email)}</p>
      <p><b>Telefon:</b> ${escapeHtml(phone)}</p>
      ${dateHuman || timeHuman ? `<p><b>Termin:</b> ${escapeHtml(dateHuman)} – ${escapeHtml(timeHuman)} (${escapeHtml(tz)})</p>` : ""}
      <p><b>Anliegen:</b> ${escapeHtml(reason)}</p>
      <p><b>Nachricht/Notiz:</b><br>${escapeHtml(notes).replace(/\\n/g,"<br>")}</p>
    `;

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: recipients,
      replyTo: email,
      subject: `${kind} – ${name}`,
      text: stripHtml(html),
      html,
    });

    return res.status(200).send("ok");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Mailversand fehlgeschlagen");
  }
}

function escapeHtml(s){return String(s).replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function stripHtml(s){return String(s).replace(/<[^>]+>/g,"");}
