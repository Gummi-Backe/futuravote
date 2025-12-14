export default function Loading() {
  return (
    <main className="page-enter min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-16 pt-10">
        <div className="h-5 w-44 rounded-full bg-white/10 animate-pulse" />

        <header className="mt-2 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <div className="h-3 w-36 rounded bg-white/10 animate-pulse" />
          <div className="mt-2 h-7 w-80 rounded bg-white/10 animate-pulse" />
          <div className="mt-3 h-4 w-96 rounded bg-white/10 animate-pulse" />
        </header>

        <section className="mt-4 grid gap-5 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-56 w-full rounded-3xl border border-white/10 bg-white/5 animate-pulse"
            />
          ))}
        </section>
      </div>
    </main>
  );
}

