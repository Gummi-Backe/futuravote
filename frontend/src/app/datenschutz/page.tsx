import { SmartBackButton } from "@/app/components/SmartBackButton";

export const metadata = {
  title: "Datenschutz - Future-Vote",
};

export default function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-16 pt-10 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <SmartBackButton fallbackHref="/" label="← Zurück" />

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
                Future-Vote ist eine Prognose- und Abstimmungsplattform. Du kannst öffentliche Fragen ansehen und
                abstimmen. Registrierte Nutzerinnen und Nutzer können neue Fragen als Vorschläge (Drafts) einreichen.
                Private Umfragen sind nur über einen Link erreichbar.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">3. Hosting und Server-Logfiles</h2>
              <p className="mt-2 text-slate-200">
                Wir hosten die Website bei <span className="font-semibold text-white">Vercel</span>. Beim Aufruf der Website
                werden technisch notwendige Daten verarbeitet (z. B. IP-Adresse, Zeitpunkt, aufgerufene Seite, User-Agent,
                Referrer, Fehlercodes), um die Website auszuliefern und die Sicherheit zu gewährleisten.
              </p>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO (berechtigtes Interesse an sicherem und stabilem
                Betrieb).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">4. Datenbank und Speicherung (Supabase)</h2>
              <p className="mt-2 text-slate-200">
                Wir nutzen <span className="font-semibold text-white">Supabase</span> (Datenbank/Storage), um Inhalte und
                Nutzungsdaten zu speichern. Unsere primäre Datenbank läuft in der Region{" "}
                <span className="font-semibold text-white">Central EU (Frankfurt)</span> (AWS). Je nach Funktion können
                dabei insbesondere folgende Daten gespeichert werden: Kontodaten (E-Mail, Anzeigename, Passwort-Hash),
                Fragen/Drafts, Abstimmungen/Reviews, Kommentare, Meldungen, Zeitstempel sowie technische Kennungen
                (Session-IDs).
              </p>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO (Bereitstellung der Plattform) und Art.&nbsp;6
                Abs.&nbsp;1 lit.&nbsp;f DSGVO (Integrität, Missbrauchsschutz, Betrieb).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">5. E-Mail-Versand (Systemmails)</h2>
              <p className="mt-2 text-slate-200">
                Für Systemmails (z. B. E-Mail-Verifikation, Passwort zurücksetzen) nutzen wir einen SMTP-Dienst von{" "}
                <span className="font-semibold text-white">Strato</span>. Dabei werden deine E-Mail-Adresse und die für den
                jeweiligen Versand nötigen Inhalte verarbeitet.
              </p>
              <p className="mt-2 text-slate-300">Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">6. Cookies / lokale Kennungen</h2>
              <p className="mt-2 text-slate-200">
                Future-Vote nutzt technisch notwendige Cookies, damit Abstimmungen und Logins funktionieren.
              </p>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-slate-200">
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <span className="font-semibold text-white">fv_session</span>: anonyme Session-Kennung, um z. B. doppelte
                    Abstimmungen/Reviews zu verhindern und den Abstimmungsstatus anzuzeigen (typisch bis zu 1 Jahr).
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
              <h2 className="text-base font-semibold text-white">7. Registrierung, Login und Nutzerkonto</h2>
              <p className="mt-2 text-slate-200">
                Wenn du ein Konto erstellst oder dich anmeldest, verarbeiten wir insbesondere: E-Mail-Adresse, Anzeigename,
                Passwort (nur als Hash gespeichert), Account-Rolle (z. B. Admin) und Zeitstempel. Zur Absicherung können
                wir bei bestimmten Vorgängen (z. B. Passwort-Reset) technische Daten kurzzeitig zur Missbrauchserkennung
                verarbeiten (z. B. IP-Adresse in Server-Logs bzw. temporär zur Rate-Limit-Prüfung).
              </p>
              <p className="mt-2 text-slate-300">Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">8. Inhalte, Abstimmungen, Reviews, Kommentare</h2>
              <p className="mt-2 text-slate-200">
                Je nach Nutzung speichern wir Inhalte und Interaktionen (z. B. Frage-Titel/Beschreibung, Abstimmungen,
                Reviews, Kommentare, Favoriten). Um Abstimmungen ohne Login zu ermöglichen, werden Interaktionen außerdem
                einer anonymen Session-Kennung zugeordnet.
              </p>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO sowie Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO
                (Missbrauchsschutz/Integrität).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">9. Feedback und Kontakt</h2>
              <p className="mt-2 text-slate-200">
                Wenn du uns Feedback sendest, verarbeiten wir die von dir übermittelten Inhalte. Optional können
                technische Informationen (z. B. URL, Browser) mitgesendet werden, um Fehler schneller nachzuvollziehen.
              </p>
              <p className="mt-2 text-slate-300">Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">10. Analytics (interne Statistik)</h2>
              <p className="mt-2 text-slate-200">
                Wir erfassen einfache Nutzungsereignisse (z. B. Seitenaufrufe, Votes, Shares, Registrierungen) als interne
                Statistik in unserer Datenbank (Supabase). Dabei speichern wir insbesondere Ereignisname, Zeitpunkt, Pfad
                und eine Session-ID. Wir verwenden diese Daten, um die Plattform zu verbessern und Missbrauch zu erkennen.
              </p>
              <p className="mt-2 text-slate-300">Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">11. KI-Unterstützung (nur Admin-Funktionen)</h2>
              <p className="mt-2 text-slate-200">
                Für einzelne Admin-Funktionen kann KI-Unterstützung genutzt werden (z. B. Recherche-Vorschläge zur
                Auflösung von Fragen oder Bild-Erstellung). Dabei können Inhalte der Frage (z. B. Titel, Beschreibung,
                Auflösungsregeln) an externe KI-Dienste übertragen werden. Die Entscheidung trifft immer ein Mensch; die
                KI liefert nur Vorschläge bzw. Inhalte.
              </p>
              <p className="mt-2 text-slate-300">
                Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO (Effizienz/Qualität in Moderation und Betrieb).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">12. Empfänger / Dienstleister</h2>
              <p className="mt-2 text-slate-200">Wir setzen Dienstleister ein, die Daten in unserem Auftrag verarbeiten, z. B.:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-200">
                <li>
                  <span className="font-semibold text-white">Vercel</span> (Hosting).
                </li>
                <li>
                  <span className="font-semibold text-white">Supabase</span> (Datenbank/Storage, Region: Central EU (Frankfurt)).
                </li>
                <li>
                  <span className="font-semibold text-white">Strato</span> (E-Mail-Versand via SMTP).
                </li>
                <li>
                  <span className="font-semibold text-white">KI-Dienste</span> (nur Admin-Funktionen, falls genutzt).
                </li>
              </ul>
              <p className="mt-2 text-slate-200">
                Fehler-Tracking (Sentry) ist in der aktuellen Produktivkonfiguration nicht aktiviert.
              </p>
              <p className="mt-2 text-slate-300">
                Je nach Dienstleister können Daten in Drittländern verarbeitet werden. In solchen Fällen stellen wir –
                soweit erforderlich – geeignete Garantien bereit (z. B. Standardvertragsklauseln).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">13. Speicherdauer</h2>
              <p className="mt-2 text-slate-200">
                Wir speichern Daten grundsätzlich nur so lange, wie es für die jeweiligen Zwecke erforderlich ist oder
                gesetzliche Aufbewahrungspflichten bestehen.
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-200">
                <li>Kontodaten: bis zur Löschung des Kontos.</li>
                <li>Login-Sessions: bis Logout oder Ablauf (typisch bis zu 30 Tage).</li>
                <li>Anonyme Abstimmungs-Session: typischerweise bis zu 1 Jahr.</li>
                <li>Verifikations-/Reset-Tokens: bis Ablauf oder Nutzung.</li>
                <li>Meldungen/Moderationsdaten: bis zur Bearbeitung und ggf. zur Rechtsverteidigung.</li>
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
              <p className="mt-2 text-slate-200">
                Du kannst dein Konto außerdem jederzeit selbst im Profil unter <span className="font-semibold text-white">„Account löschen“</span>{" "}
                löschen. Dabei werden personenbezogene Kontodaten entfernt; öffentliche Inhalte (z. B. Fragen oder Abstimmungen) können aus
                Gründen der Nachvollziehbarkeit anonymisiert bestehen bleiben.
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
