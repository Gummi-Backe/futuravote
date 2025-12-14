export default function ProfilLoading() {
  return (
    <main className="page-enter min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-10">
        <div className="h-5 w-40 rounded-full bg-white/10 animate-pulse" />

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <div className="h-7 w-32 rounded-lg bg-white/10 animate-pulse" />
          <div className="mt-3 h-4 w-72 rounded-lg bg-white/10 animate-pulse" />

          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="h-4 w-28 rounded-lg bg-white/10 animate-pulse" />
                <div className="h-4 w-40 rounded-lg bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-black/30 px-3 py-3">
            <div className="h-4 w-40 rounded-lg bg-white/10 animate-pulse" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-9 w-full rounded-full bg-white/10 animate-pulse" />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

