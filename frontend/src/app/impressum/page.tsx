import Link from "next/link";

export const metadata = {
  title: "Impressum - Future-Vote",
};

export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-16 pt-10 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link href="/" className="text-sm text-emerald-100 hover:text-emerald-200">
          &larr; Zurück zum Feed
        </Link>

        <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Impressum</h1>
          <p className="mt-2 text-sm text-slate-300">
            Platzhalter: Bitte trage hier deine echten Angaben ein (Name/Anschrift/Kontakt). Das Impressum ist in
            Deutschland rechtlich erforderlich.
          </p>

          <div className="mt-6 space-y-6 text-sm text-slate-100">
            <section>
              <h2 className="text-base font-semibold text-white">Anbieter</h2>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-slate-200">
                <p className="font-semibold text-white">[Dein Name / Firma]</p>
                <p>[Straße Hausnummer]</p>
                <p>[PLZ Ort]</p>
                <p>[Land]</p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">Kontakt</h2>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-slate-200">
                <p>E-Mail: [kontakt@deine-domain.de]</p>
                <p>Telefon: [optional]</p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white">Verantwortlich für Inhalte</h2>
              <p className="mt-2 text-slate-300">
                Platzhalter: Trage hier die verantwortliche Person gemäß den geltenden Vorschriften ein.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

