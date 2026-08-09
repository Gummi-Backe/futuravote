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

function ExamplePill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "prognose" | "meinung" }) {
  const classes =
    tone === "prognose"
      ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
      : tone === "meinung"
      ? "border-amber-300/35 bg-amber-500/10 text-amber-100"
      : "border-white/10 bg-white/5 text-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}>
      {children}
    </span>
  );
}

function MiniVoteBar({ yesPct, noPct }: { yesPct: number; noPct: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-emerald-400" style={{ width: `${yesPct}%` }} />
      <div className="absolute right-0 top-0 h-full bg-rose-400" style={{ width: `${noPct}%` }} />
    </div>
  );
}

function ExampleCardFrame({
  headerLeft,
  headerRight,
  children,
}: {
  headerLeft: React.ReactNode;
  headerRight: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="relative mx-auto flex h-full w-full max-w-[18rem] flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 shadow-lg shadow-emerald-500/10">
      <div className="flex items-start justify-between gap-3">
        {headerLeft}
        {headerRight}
      </div>
      {children}
      <div className="text-[9px] text-slate-400">Symbolisches Beispiel, nicht anklickbar.</div>
    </article>
  );
}

function ExampleBinaryCard({
  title,
  category,
  region,
  badge,
  tone,
  yesPct,
  noPct,
}: {
  title: string;
  category: string;
  region: string;
  badge: React.ReactNode;
  tone: "prognose" | "meinung";
  yesPct: number;
  noPct: number;
}) {
  return (
    <ExampleCardFrame
      headerLeft={
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 overflow-hidden rounded-full bg-black/30">
            <img src="/icons/icon-192.png" alt="" className="h-full w-full object-cover opacity-90" loading="lazy" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-300">{category}</div>
            <div className="truncate text-[11px] font-semibold text-slate-200">{region}</div>
          </div>
        </div>
      }
      headerRight={
        <div className="flex flex-col items-end gap-2">
          {badge}
          <ExamplePill tone={tone}>{tone === "prognose" ? "Prognose" : "Meinungs-Umfrage"}</ExamplePill>
        </div>
      }
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="inline-flex max-h-14 max-w-[3.8rem] items-center justify-center overflow-hidden rounded-lg bg-black/30">
            <img
              src="/icons/icon-512.png"
              alt=""
              className="h-auto w-auto max-h-14 max-w-[3.8rem] object-contain"
              loading="lazy"
            />
          </div>
          <p className="mt-1 text-[9px] leading-tight text-slate-400">Bild: Beispiel</p>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="card-title-wrap line-clamp-3 text-sm font-semibold leading-snug text-white">{title}</h3>
          <div className="mt-1.5 inline-flex rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-100">
            Details ansehen
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-200">Endet in 14 Tagen</span>
        <span className="font-semibold text-slate-200">
          Ja {yesPct}% · Nein {noPct}%
        </span>
      </div>
      <MiniVoteBar yesPct={yesPct} noPct={noPct} />

      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled className="card-button yes cursor-default py-1.5 text-xs opacity-80">
          Ja
        </button>
        <button type="button" disabled className="card-button no cursor-default py-1.5 text-xs opacity-80">
          Nein
        </button>
      </div>
    </ExampleCardFrame>
  );
}

function ExampleOptionsCard() {
  const options = [
    { pct: 48, label: "Option A – eher positiv" },
    { pct: 32, label: "Option B – gemischt" },
    { pct: 14, label: "Option C – eher kritisch" },
    { pct: 6, label: "Option D – keine Meinung" },
  ];

  return (
    <ExampleCardFrame
      headerLeft={
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 overflow-hidden rounded-full bg-black/30">
            <img src="/icons/icon-192.png" alt="" className="h-full w-full object-cover opacity-90" loading="lazy" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-300">Wirtschaft</div>
            <div className="truncate text-[11px] font-semibold text-slate-200">Deutschland</div>
          </div>
        </div>
      }
      headerRight={
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">
            Neu
          </span>
          <ExamplePill tone="meinung">Meinungs-Umfrage · Optionen</ExamplePill>
        </div>
      }
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="inline-flex max-h-14 max-w-[3.8rem] items-center justify-center overflow-hidden rounded-lg bg-black/30">
            <img
              src="/icons/icon-512.png"
              alt=""
              className="h-auto w-auto max-h-14 max-w-[3.8rem] object-contain"
              loading="lazy"
            />
          </div>
          <p className="mt-1 text-[9px] leading-tight text-slate-400">Bild: Beispiel</p>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="card-title-wrap line-clamp-3 text-sm font-semibold leading-snug text-white">
            Welche Option hältst du für am sinnvollsten?
          </h3>
          <div className="mt-1.5 inline-flex rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-100">
            Details ansehen
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-200">Endet in 22 Tagen</span>
        <span className="font-semibold text-slate-200">Optionen</span>
      </div>

      <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/5 p-2">
        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Antwortoptionen</div>
        <div className="space-y-1.5">
          {options.map((opt) => (
            <div key={opt.label} className="flex items-center gap-2">
              <div className="w-8 shrink-0 text-[9px] font-semibold tabular-nums text-slate-200">{opt.pct}%</div>
              <div className="relative h-[12px] flex-1 overflow-hidden rounded-md bg-white/5">
                <div className="absolute inset-y-0 left-0 rounded-md bg-emerald-400/40" style={{ width: `${opt.pct}%` }} />
                <div className="absolute inset-0 flex items-center px-2">
                  <span className="min-w-0 truncate text-[9px] font-semibold text-slate-100">{opt.label}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ExampleCardFrame>
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
              <li>Formuliere messbar: Es muss am Ende eindeutig &quot;Ja&quot; oder &quot;Nein&quot; sein.</li>
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

          <InfoCard title="3) Meinungs-Umfragen (Ja/Nein und Optionen)">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Ja/Nein-Umfrage: &quot;Ja&quot; und &quot;Nein&quot; sind eine direkte Zustimmung/Ablehnung zur Frage.
              </li>
            </ul>
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold text-slate-300">Mini-Beispiel: Meinungs-Umfrage (Ja/Nein)</div>
              <ExampleBinaryCard
                tone="meinung"
                category="Gesellschaft"
                region="Deutschland"
                title="Sollte Maßnahme X künftig von der Allgemeinheit finanziert werden?"
                yesPct={50}
                noPct={50}
                badge={<span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">Neu</span>}
              />
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Umfrage mit Optionen: Du wählst eine der vorgegebenen Antwortoptionen.
              </li>
              <li>Das Ergebnis zeigt, wie die Community aktuell abstimmt und ist nicht automatisch repräsentativ.</li>
            </ul>
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold text-slate-300">Mini-Beispiel: Meinungs-Umfrage (Optionen)</div>
              <ExampleOptionsCard />
            </div>
          </InfoCard>

          <InfoCard title="4) Prognosen (spätere Auflösung)">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Bei Prognosen gibt es ein Enddatum und klare Auflösungs-Regeln. Danach wird ein tatsächliches Ergebnis
                eingetragen.
              </li>
              <li>
                &quot;Ja&quot; bedeutet hier: Du hältst es bis zum Enddatum für wahrscheinlicher, dass das Ereignis eintritt.
              </li>
              <li>Im Archiv siehst du später Ergebnis, Quelle und wie die Community lag.</li>
            </ul>
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold text-slate-300">Mini-Beispiel: Prognose</div>
              <ExampleBinaryCard
                tone="prognose"
                category="Politik"
                region="Baden-Württemberg"
                title="Erreicht Partei A bei der Wahl 2026 die meisten Stimmen?"
                yesPct={75}
                noPct={25}
                badge={<span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">Neu</span>}
              />
            </div>
          </InfoCard>

          <InfoCard title="5) Private Umfragen (nur per Link)">
            <ul className="list-disc space-y-2 pl-5">
              <li>Private Umfragen erscheinen nicht im öffentlichen Feed.</li>
              <li>Jeder mit dem Link kann bis zum Endzeitpunkt abstimmen.</li>
            </ul>
          </InfoCard>

          <InfoCard title="6) Kommentare & Fair Play">
            <ul className="list-disc space-y-2 pl-5">
              <li>Bleib beim Thema der Frage und formuliere verständlich.</li>
              <li>Diskutiere respektvoll: keine Beleidigungen, kein Mobbing, keine Diskriminierung.</li>
              <li>Wenn möglich: nenne Fakten, Argumente oder Quellen – das hilft später bei der Auflösung.</li>
            </ul>
          </InfoCard>

          <InfoCard title="7) Verbotene Inhalte">
            <ul className="list-disc space-y-2 pl-5">
              <li>Keine Hassrede, keine Gewaltaufrufe, keine extremistischen Inhalte.</li>
              <li>Keine pornografischen oder besonders verstörenden Inhalte.</li>
              <li>Keine Werbung/Spam (z. B. Affiliate-Links, Gutscheine, Eigenwerbung, Wahl- und Parteienwerbung).</li>
              <li>Keine Inhalte, die gegen Gesetze verstoßen.</li>
            </ul>
          </InfoCard>

          <InfoCard title="8) Privatsphäre & Urheberrecht">
            <ul className="list-disc space-y-2 pl-5">
              <li>Poste keine personenbezogenen Daten (z. B. private Adressen, Telefonnummern, E-Mail-Adressen).</li>
              <li>Lade nur Inhalte hoch, für die du die nötigen Rechte hast (z. B. Bilder, Texte, Zitate).</li>
            </ul>
          </InfoCard>

          <InfoCard title="9) Moderation & Konsequenzen">
            <ul className="list-disc space-y-2 pl-5">
              <li>Wir können Beiträge ausblenden oder löschen, wenn sie gegen diese Regeln verstoßen.</li>
              <li>Bei schweren oder wiederholten Verstößen können Konten eingeschränkt oder gesperrt werden.</li>
              <li>
                Wenn dir etwas auffällt: Nutze den <span className="font-semibold">&quot;Melden&quot;</span>-Button in den Details.
              </li>
            </ul>
          </InfoCard>

          <InfoCard title="10) Account löschen">
            <p>
              Du kannst dein Konto jederzeit selbst im Profil unter{" "}
              <span className="font-semibold">&quot;Account löschen&quot;</span> löschen. Dabei werden personenbezogene Kontodaten
              entfernt; öffentliche Inhalte können anonymisiert bestehen bleiben.
            </p>
          </InfoCard>
        </div>
      </div>
    </main>
  );
}
