import nodemailer from "nodemailer";

const SMTP_HOST = process.env.FV_SMTP_HOST;
const SMTP_PORT = process.env.FV_SMTP_PORT ? Number(process.env.FV_SMTP_PORT) : 587;
const SMTP_USER = process.env.FV_SMTP_USER;
const SMTP_PASS = process.env.FV_SMTP_PASS;
const EMAIL_FROM = process.env.FV_EMAIL_FROM ?? "no-reply@future-vote.de";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendVerificationEmail(options: {
  to: string;
  displayName: string;
  verificationUrl: string;
}): Promise<void> {
  const transport = getTransporter();

  const subject = "Bitte bestaetige deine E-Mail-Adresse fuer Future-Vote";
  const text = [
    `Hallo ${options.displayName || "Future-Vote Nutzer"},`,
    "",
    "bitte bestaetige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:",
    options.verificationUrl,
    "",
    "Wenn du keinen Account bei Future-Vote angelegt hast, kannst du diese E-Mail ignorieren.",
  ].join("\n");

  const html = `
    <p>Hallo ${options.displayName || "Future-Vote Nutzer"},</p>
    <p>bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:</p>
    <p><a href="${options.verificationUrl}">${options.verificationUrl}</a></p>
    <p>Wenn du keinen Account bei Future-Vote angelegt hast, kannst du diese E-Mail ignorieren.</p>
  `;

  if (!transport) {
    // Dev-/Fallback-Modus: Link nur im Log ausgeben
    console.log("[Future-Vote] Verifikationslink:", options.verificationUrl);
    return;
  }

  await transport.sendMail({
    from: EMAIL_FROM,
    to: options.to,
    subject,
    text,
    html,
  });
}

