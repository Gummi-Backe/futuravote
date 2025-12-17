import Link from "next/link";

export const metadata = {
  title: "Datenschutz - Future-Vote",
};

export default function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-16 pt-10 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link href="/" className="text-sm text-emerald-100 hover:text-emerald-200">
          &larr; Zurück zum Feed
        </Link>

        <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Datenschutzerklärung</h1>
          <p className="mt-2 text-sm text-slate-300">
            Mit dieser Erklärung informieren wir dich darüber, welche personenbezogenen Daten wir bei der Nutzung von
            Future-Vote verarbeiten, zu welchen Zwecken und welche Rechte du hast.
          </p>

          <div className="mt-6 space-y-6 text-sm text-slate-100">
            <section>
              <h2 className="text-base font-semibold text-white">1. Verantwortlicher</h2>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-slate-200">
                <p className="font-semibold text-white">Roland Kerner</p>
                <p>Marabustr. 2</p>
                <p>70378 Stuttgart</p>
                <p>Deutschland</p>
                <p className="mt-2">
                  E-Mail:{" "}
                  <a className="text-emerald-100 hover:text-emerald-200" href="mailto:r.kerner.developer@gmail.com">
                    r.kerner.developer@gmail.com
                  </a>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">2. Überblick: Was Future-Vote macht</h2>
              <p className="mt-2 text-slate-200">
                Future-Vote ist eine Prognose-/Abstimmungsplattform. Nutzer können Fragen einreichen, abstimmen und im
                Review-Bereich über neue Vorschläge entscheiden. Es gibt öffentliche Umfragen (im Feed sichtbar) und
                private Umfragen, die nur über einen Link erreichbar sind.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">3. Hosting &amp; Server-Logfiles</h2>
              <p className="mt-2 text-slate-200">
                Die Website wird über einen Hosting-Anbieter ausgeliefert. Dabei fallen technisch notwendige Daten an,
                um die Website an dein Gerät ausliefern und die Sicherheit gewährleisten zu können (z.&nbsp;B.
                IP-Adresse, Zeitpunkt, aufgerufene Seite, User-Agent, Referrer, Fehlercodes).
              </p>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO (berechtigtes Interesse an sicherem und
                stabilem Betrieb).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">4. Cookies / lokale Kennungen</h2>
              <p className="mt-2 text-slate-200">
                Future-Vote nutzt technisch notwendige Cookies, damit Abstimmungen und Logins funktionieren.
              </p>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-slate-200">
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <span className="font-semibold text-white">fv_session</span>: anonyme Session-Kennung, um z.&nbsp;B.
                    doppelte Abstimmungen/Reviews zu verhindern (typisch bis zu 1 Jahr).
                  </li>
                  <li>
                    <span className="font-semibold text-white">fv_user</span>: Login-Session-Kennung, um angemeldet zu
                    bleiben (typisch bis zu 30 Tage oder bis zum Logout).
                  </li>
                </ul>
              </div>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO (Nutzung der Plattform) und Art.&nbsp;6
                Abs.&nbsp;1 lit.&nbsp;f DSGVO (Missbrauchsschutz/Integrität).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">5. Registrierung, Login &amp; Nutzerkonto</h2>
              <p className="mt-2 text-slate-200">
                Wenn du ein Konto erstellst oder dich anmeldest, verarbeiten wir insbesondere: E-Mail-Adresse,
                Anzeigename, Passwort-Hash (nicht das Klartext-Passwort) sowie eine Session-ID zur Anmeldung.
              </p>
              <p className="mt-2 text-slate-300">
                Zweck: Kontoerstellung, Anmeldung, Missbrauchsschutz, Zuordnung von Aktionen (z.&nbsp;B. Erstellen von
                Fragen), Profilfunktionen.
              </p>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">6. E-Mail-Verifikation &amp; Passwort-Reset</h2>
              <p className="mt-2 text-slate-200">
                Zur Bestätigung deiner E-Mail-Adresse und für das Zurücksetzen deines Passworts versenden wir E-Mails
                mit Links/Tokens. Dabei verarbeiten wir deine E-Mail-Adresse und technisch notwendige Token (zeitlich
                begrenzt).
              </p>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-slate-200">
                <ul className="list-disc space-y-2 pl-5">
                  <li>E-Mail-Verifikations-Tokens sind typischerweise bis zu 24 Stunden gültig.</li>
                  <li>Passwort-Reset-Tokens sind typischerweise bis zu 60 Minuten gültig.</li>
                </ul>
              </div>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">7. Inhalte: Fragen, Beschreibungen, Bilder</h2>
              <p className="mt-2 text-slate-200">
                Wenn du eine Frage einreichst, verarbeiten wir die von dir eingegebenen Inhalte (Titel, Beschreibung,
                Kategorie/Region, Laufzeit, ggf. Bild und Bildquelle). Öffentliche Inhalte sind im Feed sichtbar; private
                Umfragen sind nicht im Feed gelistet.
              </p>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO (Bereitstellung der Funktion).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">8. Abstimmungen, Reviews &amp; Statistiken</h2>
              <p className="mt-2 text-slate-200">
                Bei Abstimmungen/Reviews speichern wir deine Auswahl (z.&nbsp;B. Ja/Nein bzw. Gut/Schlecht) zusammen
                mit einer Session-Kennung und einem Zeitstempel. Das ist notwendig, um Mehrfachabstimmungen zu verhindern
                und um Statistiken/Trends (z.&nbsp;B. Zeitverlauf) anzuzeigen.
              </p>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO und Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO
                (Integrität/Missbrauchsschutz).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">9. Private Umfragen (nur per Link)</h2>
              <p className="mt-2 text-slate-200">
                Private Umfragen sind nicht im öffentlichen Feed gelistet. Jeder mit dem Link kann – je nach Umfrage –
                abstimmen und/oder eine Meldung abgeben. Der Link enthält eine Kennung, damit die Umfrage aufgerufen
                werden kann.
              </p>
              <p className="mt-2 text-slate-300">
                Hinweis: Wenn du einen privaten Link teilst, entscheidest du selbst, wer Zugriff erhält.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">10. Meldungen (Spam/beleidigend)</h2>
              <p className="mt-2 text-slate-200">
                Nutzer können Inhalte melden. Dabei speichern wir den Meldetext/Grund, den Bezug zur gemeldeten Kachel
                sowie technische Informationen zur Bearbeitung (z.&nbsp;B. Zeitstempel, Session-Kennung).
              </p>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO (Missbrauchs- und Rechtsabwehr, Qualität der
                Plattform).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">11. KI-Unterstützung bei Auflösungen</h2>
              <p className="mt-2 text-slate-200">
                Für die Auflösung von Fragen kann eine KI-Unterstützung genutzt werden: Dabei werden Inhalte der Frage
                (z.&nbsp;B. Titel, Auflösungs-Regeln) an einen externen KI-Dienst übertragen, damit Quellen und ein
                Vorschlag recherchiert werden. Die Entscheidung trifft immer ein Mensch; die KI liefert nur Vorschläge.
              </p>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO (Effizienz und Qualität bei der Moderation/
                Auflösung) bzw. Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO (Betrieb der Plattform).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">12. Empfänger / Dienstleister</h2>
              <p className="mt-2 text-slate-200">
                Wir nutzen Dienstleister, die Daten in unserem Auftrag verarbeiten, z.&nbsp;B.:
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-200">
                <li>
                  <span className="font-semibold text-white">Supabase</span> (Datenbank/Storage) für die Speicherung von
                  Fragen, Abstimmungen, Sessions, Meldungen und Bildern.
                </li>
                <li>
                  <span className="font-semibold text-white">E-Mail-/SMTP-Dienst</span> für Verifikations- und
                  Passwort-Reset-E-Mails.
                </li>
                <li>
                  <span className="font-semibold text-white">KI-Dienst</span> (z.&nbsp;B. Perplexity) für
                  Recherche-Vorschläge bei Auflösungen.
                </li>
              </ul>
              <p className="mt-2 text-slate-300">
                Je nach Dienstleister können Daten in Drittländern verarbeitet werden. In solchen Fällen stellen wir
                – soweit erforderlich – geeignete Garantien bereit (z.&nbsp;B. Standardvertragsklauseln).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">13. Speicherdauer</h2>
              <p className="mt-2 text-slate-200">
                Wir speichern Daten grundsätzlich nur so lange, wie es für die jeweiligen Zwecke erforderlich ist oder
                gesetzliche Aufbewahrungspflichten bestehen. Typische Beispiele:
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-200">
                <li>Kontodaten: bis zur Löschung des Kontos.</li>
                <li>Login-Sessions: bis Logout oder Ablauf (typisch bis zu 30 Tage).</li>
                <li>Anonyme Abstimmungs-Session: typischerweise bis zu 1 Jahr.</li>
                <li>Verifikations-/Reset-Tokens: bis Ablauf oder Nutzung.</li>
                <li>Meldungen: bis zur Bearbeitung und ggf. zur Rechtsverteidigung.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">14. Deine Rechte</h2>
              <p className="mt-2 text-slate-200">
                Du hast – soweit die gesetzlichen Voraussetzungen vorliegen – das Recht auf Auskunft, Berichtigung,
                Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung.
              </p>
              <p className="mt-2 text-slate-200">
                Außerdem hast du das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">15. Änderungen</h2>
              <p className="mt-2 text-slate-200">
                Wir passen diese Datenschutzerklärung an, wenn sich Funktionen oder rechtliche Anforderungen ändern.
                Stand: Dezember 2025.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
