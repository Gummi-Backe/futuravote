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
export async function sendPasswordResetEmail(options: {
  to: string;
  displayName: string;
  resetUrl: string;
}): Promise<void> {
  const transport = getTransporter();

  const subject = "Passwort zuruecksetzen fuer Future-Vote";
  const text = [
    `Hallo ${options.displayName || "Future-Vote Nutzer"},`,
    "",
    "du hast (oder jemand anderes hat) ein Zuruecksetzen deines Passworts angefordert.",
    "Klicke auf den folgenden Link, um ein neues Passwort zu setzen:",
    options.resetUrl,
    "",
    "Der Link ist nur kurze Zeit gueltig. Wenn du das nicht warst, ignoriere diese E-Mail.",
  ].join("\n");

  const html = `
    <p>Hallo ${options.displayName || "Future-Vote Nutzer"},</p>
    <p>du hast (oder jemand anderes hat) ein Zuruecksetzen deines Passworts angefordert.</p>
    <p>Klicke auf den folgenden Link, um ein neues Passwort zu setzen:</p>
    <p><a href="${options.resetUrl}">${options.resetUrl}</a></p>
    <p><strong>Hinweis:</strong> Der Link ist nur kurze Zeit gueltig. Wenn du das nicht warst, ignoriere diese E-Mail.</p>
  `;

  if (!transport) {
    console.log("[Future-Vote] Passwort-Reset-Link:", options.resetUrl);
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

export async function sendPrivatePollResultEmail(options: {
  to: string;
  displayName: string;
  title: string;
  pollUrl: string;
  closesAtLabel: string;
  yesVotes: number;
  noVotes: number;
}): Promise<void> {
  const transport = getTransporter();

  const totalVotes = Math.max(0, (options.yesVotes ?? 0) + (options.noVotes ?? 0));
  const yesPct = totalVotes > 0 ? Math.round((options.yesVotes / totalVotes) * 100) : 0;
  const noPct = totalVotes > 0 ? 100 - yesPct : 0;

  const subject = `Private Umfrage beendet: ${options.title}`;

  const text = [
    `Hallo ${options.displayName || "Future-Vote Nutzer"},`,
    "",
    `deine private Umfrage ist beendet (${options.closesAtLabel}).`,
    "",
    `Ergebnis: Ja ${options.yesVotes} (${yesPct}%) · Nein ${options.noVotes} (${noPct}%) · Stimmen gesamt ${totalVotes}`,
    "",
    "Hier kannst du die Umfrage ansehen:",
    options.pollUrl,
    "",
    "Hinweis: Das Ergebnis basiert auf den abgegebenen Stimmen.",
  ].join("\n");

  const html = `
    <p>Hallo ${options.displayName || "Future-Vote Nutzer"},</p>
    <p>deine private Umfrage ist beendet (<strong>${options.closesAtLabel}</strong>).</p>
    <p>
      <strong>Ergebnis:</strong>
      Ja ${options.yesVotes} (${yesPct}%) &middot; Nein ${options.noVotes} (${noPct}%) &middot;
      Stimmen gesamt ${totalVotes}
    </p>
    <p>
      <a href="${options.pollUrl}">Umfrage öffnen</a>
    </p>
    <p style="color:#94a3b8;font-size:12px">Hinweis: Das Ergebnis basiert auf den abgegebenen Stimmen.</p>
  `;

  if (!transport) {
    console.log("[Future-Vote] Private Umfrage Ergebnis:", { to: options.to, pollUrl: options.pollUrl, subject });
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

export async function sendPrivatePollEndingSoonEmail(options: {
  to: string;
  displayName: string;
  title: string;
  pollUrl: string;
  closesAtLabel: string;
}): Promise<void> {
  const transport = getTransporter();

  const subject = `Private Umfrage endet bald: ${options.title}`;

  const text = [
    `Hallo ${options.displayName || "Future-Vote Nutzer"},`,
    "",
    `deine private Umfrage endet bald (${options.closesAtLabel}).`,
    "Wenn du noch Stimmen einsammeln willst, teile den Link jetzt noch einmal.",
    "",
    "Hier kannst du die Umfrage ansehen:",
    options.pollUrl,
  ].join("\n");

  const html = `
    <p>Hallo ${options.displayName || "Future-Vote Nutzer"},</p>
    <p>deine private Umfrage endet bald (<strong>${options.closesAtLabel}</strong>).</p>
    <p style="color:#cbd5e1">Wenn du noch Stimmen einsammeln willst, teile den Link jetzt noch einmal.</p>
    <p><a href="${options.pollUrl}">Umfrage öffnen</a></p>
  `;

  if (!transport) {
    console.log("[Future-Vote] Private Umfrage Erinnerung (endet bald):", { to: options.to, pollUrl: options.pollUrl, subject });
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

export async function sendCreatorPublicQuestionEndedEmail(options: {
  to: string;
  displayName: string;
  title: string;
  questionUrl: string;
  closesAtLabel: string;
}): Promise<void> {
  const transport = getTransporter();

  const subject = `Deine Frage ist beendet: ${options.title}`;

  const text = [
    `Hallo ${options.displayName || "Future-Vote Nutzer"},`,
    "",
    `deine öffentliche Frage ist beendet (${options.closesAtLabel}).`,
    "Die Abstimmung ist geschlossen. Das endgültige Ergebnis (Ja/Nein) wird später mit Quelle aufgelöst.",
    "",
    "Hier kannst du deine Frage ansehen:",
    options.questionUrl,
  ].join("\n");

  const html = `
    <p>Hallo ${options.displayName || "Future-Vote Nutzer"},</p>
    <p>deine öffentliche Frage ist beendet (<strong>${options.closesAtLabel}</strong>).</p>
    <p style="color:#cbd5e1">Die Abstimmung ist geschlossen. Das endgültige Ergebnis (Ja/Nein) wird später mit Quelle aufgelöst.</p>
    <p><a href="${options.questionUrl}">Frage öffnen</a></p>
  `;

  if (!transport) {
    console.log("[Future-Vote] Creator Question Ended:", { to: options.to, questionUrl: options.questionUrl, subject });
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

export async function sendCreatorPublicQuestionResolvedEmail(options: {
  to: string;
  displayName: string;
  title: string;
  questionUrl: string;
  resolvedOutcomeLabel: string;
  resolvedSource?: string | null;
}): Promise<void> {
  const transport = getTransporter();

  const subject = `Frage aufgelöst (${options.resolvedOutcomeLabel}): ${options.title}`;

  const sourceLine = options.resolvedSource ? `Quelle: ${options.resolvedSource}` : "";

  const text = [
    `Hallo ${options.displayName || "Future-Vote Nutzer"},`,
    "",
    `deine Frage wurde aufgelöst: Ergebnis = ${options.resolvedOutcomeLabel}.`,
    sourceLine,
    "",
    "Hier kannst du die Frage ansehen:",
    options.questionUrl,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p>Hallo ${options.displayName || "Future-Vote Nutzer"},</p>
    <p>deine Frage wurde aufgelöst: <strong>Ergebnis = ${options.resolvedOutcomeLabel}</strong>.</p>
    ${
      options.resolvedSource
        ? `<p style="color:#cbd5e1;font-size:12px">Quelle: <a href="${options.resolvedSource}">${options.resolvedSource}</a></p>`
        : ""
    }
    <p><a href="${options.questionUrl}">Frage öffnen</a></p>
  `;

  if (!transport) {
    console.log("[Future-Vote] Creator Question Resolved:", {
      to: options.to,
      questionUrl: options.questionUrl,
      subject,
      resolvedSource: options.resolvedSource ?? null,
    });
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
