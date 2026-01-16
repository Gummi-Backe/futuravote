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
        <SmartBackButton fallbackHref="/" label="← Zurück" />

        <header className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Regeln & Auflösung</h1>
          <p className="mt-2 text-sm text-slate-300">
            Future-Vote lebt davon, dass Fragen klar formuliert sind und Ergebnisse transparent nachvollzogen werden.
            Hier findest du die wichtigsten Regeln – kurz und verständlich.
          </p>
        </header>

        <div className="space-y-4">
          <InfoCard title="1) Klare Fragen (wichtig für Seriosität)">
            <ul className="list-disc space-y-2 pl-5">
              <li>Formuliere messbar: Es muss am Ende eindeutig "Ja" oder "Nein" sein.</li>
              <li>Schreibe Datum/Zeitraum in den Titel, wenn das Ergebnis davon abhängt.</li>
              <li>Vermeide doppelte Fragen – wenn es das Thema schon gab, ändere Zeitraum oder Kriterium.</li>
            </ul>
          </InfoCard>

          <InfoCard title="2) Auflösung & Quellen">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Jede öffentliche Frage hat Auflösungs-Regeln: <span className="font-semibold">Wann gilt Ja/Nein?</span>
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
              <li>"Ja" bedeutet: Du hältst das Ereignis bis zum Enddatum für wahrscheinlicher als "Nein".</li>
              <li>Das Ergebnis ist eine Community-Einschätzung und nicht automatisch repräsentativ.</li>
            </ul>
          </InfoCard>

          <InfoCard title="4) Private Umfragen (nur per Link)">
            <ul className="list-disc space-y-2 pl-5">
              <li>Private Umfragen erscheinen nicht im öffentlichen Feed.</li>
              <li>Jeder mit dem Link kann bis zum Endzeitpunkt abstimmen.</li>
            </ul>
          </InfoCard>

          <InfoCard title="5) Kommentare & Fair Play">
            <ul className="list-disc space-y-2 pl-5">
              <li>Bleib beim Thema der Frage und formuliere verständlich.</li>
              <li>Diskutiere respektvoll: keine Beleidigungen, kein Mobbing, keine Diskriminierung.</li>
              <li>Wenn möglich: nenne Fakten, Argumente oder Quellen – das hilft später bei der Auflösung.</li>
            </ul>
          </InfoCard>

          <InfoCard title="6) Verbotene Inhalte">
            <ul className="list-disc space-y-2 pl-5">
              <li>Keine Hassrede, keine Gewaltaufrufe, keine extremistischen Inhalte.</li>
              <li>Keine pornografischen oder besonders verstörenden Inhalte.</li>
              <li>Keine Werbung/Spam (z. B. Affiliate-Links, Gutscheine, Eigenwerbung, Wahl- und Parteienwerbung).</li>
              <li>Keine Inhalte, die gegen Gesetze verstoßen.</li>
            </ul>
          </InfoCard>

          <InfoCard title="7) Privatsphäre & Urheberrecht">
            <ul className="list-disc space-y-2 pl-5">
              <li>Poste keine personenbezogenen Daten (z. B. private Adressen, Telefonnummern, E-Mail-Adressen).</li>
              <li>Lade nur Inhalte hoch, für die du die nötigen Rechte hast (z. B. Bilder, Texte, Zitate).</li>
            </ul>
          </InfoCard>

          <InfoCard title="8) Moderation & Konsequenzen">
            <ul className="list-disc space-y-2 pl-5">
              <li>Wir können Beiträge ausblenden oder löschen, wenn sie gegen diese Regeln verstoßen.</li>
              <li>Bei schweren oder wiederholten Verstößen können Konten eingeschränkt oder gesperrt werden.</li>
              <li>
                Wenn dir etwas auffällt: Nutze den <span className="font-semibold">"Melden"</span>-Button in den Details.
              </li>
            </ul>
          </InfoCard>

          <InfoCard title="9) Account löschen">
            <p>
              Du kannst dein Konto jederzeit selbst im Profil unter{" "}
              <span className="font-semibold">"Account löschen"</span> löschen. Dabei werden personenbezogene Kontodaten
              entfernt; öffentliche Inhalte können anonymisiert bestehen bleiben.
            </p>
          </InfoCard>
        </div>
      </div>
    </main>
  );
}
