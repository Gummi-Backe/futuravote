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
          <h1 className="text-2xl font-bold text-white">Datenschutz</h1>
          <p className="mt-2 text-sm text-slate-300">
            Platzhalter: Diese Seite muss mit einer vollständigen Datenschutzerklärung befüllt werden (z. B. welche
            Daten verarbeitet werden, wofür, wie lange, welche Drittanbieter). Bitte ersetze die Punkte unten durch
            deine echten Inhalte.
          </p>

          <div className="mt-6 space-y-6 text-sm text-slate-100">
            <section>
              <h2 className="text-base font-semibold text-white">1. Welche Daten wir verarbeiten</h2>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-200">
                <li>Account-Daten (E-Mail, Anzeige-Name) bei Registrierung/Login</li>
                <li>Sessions/Cookies für Login und Abstimmungen</li>
                <li>Inhalte, die du einreichst (Fragen, Beschreibungen, Bildquelle)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">2. Zweck der Verarbeitung</h2>
              <p className="mt-2 text-slate-200">
                Betrieb der Plattform (Login, Abstimmungen, Review, Missbrauchs-Meldungen) und Darstellung von
                Statistiken im Profil.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">3. Cookies</h2>
              <p className="mt-2 text-slate-200">
                Future-Vote verwendet Cookies, um Login und Abstimmungen technisch zu ermöglichen (z. B. Session-IDs).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">4. Kontakt</h2>
              <p className="mt-2 text-slate-200">[kontakt@deine-domain.de]</p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

