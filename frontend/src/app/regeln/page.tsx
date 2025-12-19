import { SmartBackButton } from "@/app/components/SmartBackButton";

export const metadata = {
  title: "Regeln & Auflösung - Future-Vote",
};

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-2 text-sm text-slate-200">{children}</div>
    </section>
  );
}

export default function RegelnPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-16 pt-10 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <SmartBackButton
          fallbackHref="/"
          label="← Zurück"
          className="self-start text-sm text-emerald-100 hover:text-emerald-200"
        />

        <header className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Regeln & Auflösung</h1>
          <p className="mt-2 text-sm text-slate-300">
            Future‑Vote lebt davon, dass Fragen klar formuliert sind und Ergebnisse transparent nachvollzogen werden.
            Hier findest du die wichtigsten Regeln – kurz und verständlich.
          </p>
        </header>

        <div className="space-y-4">
          <InfoCard title="1) Klare Fragen (wichtig für Seriosität)">
            <ul className="list-disc space-y-2 pl-5">
              <li>Formuliere messbar: Es muss am Ende eindeutig „Ja“ oder „Nein“ sein.</li>
              <li>Schreibe Datum/Zeitraum in den Titel, wenn das Ergebnis davon abhängt.</li>
              <li>Vermeide doppelte Fragen – wenn es das Thema schon gab, ändere Zeitraum oder Kriterium.</li>
            </ul>
          </InfoCard>

          <InfoCard title="2) Auflösung & Quellen">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Jede öffentliche Frage hat Auflösungs‑Regeln: <span className="font-semibold">Wann gilt Ja/Nein?</span>
              </li>
              <li>
                Dazu gehört eine <span className="font-semibold">Quelle</span> (z. B. offizielle Seite/Institution oder
                Link), damit das Ergebnis nachprüfbar ist.
              </li>
              <li>Nach der Entscheidung wird das Ergebnis im Archiv sichtbar – inklusive Quelle/Begründung.</li>
            </ul>
          </InfoCard>

          <InfoCard title="3) Abstimmen (Ja/Nein)">
            <ul className="list-disc space-y-2 pl-5">
              <li>„Ja“ bedeutet: Du hältst das Ereignis bis zum Enddatum für wahrscheinlicher als „Nein“.</li>
              <li>Das Ergebnis ist eine Community‑Einschätzung und nicht automatisch repräsentativ.</li>
            </ul>
          </InfoCard>

          <InfoCard title="4) Private Umfragen (nur per Link)">
            <ul className="list-disc space-y-2 pl-5">
              <li>Private Umfragen erscheinen nicht im öffentlichen Feed.</li>
              <li>Jeder mit dem Link kann bis zum Endzeitpunkt abstimmen.</li>
            </ul>
          </InfoCard>

          <InfoCard title="5) Fair Play & Meldungen">
            <ul className="list-disc space-y-2 pl-5">
              <li>Kein Spam, keine Beleidigungen, keine illegalen Inhalte.</li>
              <li>Wenn dir etwas auffällt: Nutze den „Melden“-Button in den Details.</li>
            </ul>
          </InfoCard>
        </div>
      </div>
    </main>
  );
}
