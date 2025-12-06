export default function QuestionLoading() {
  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-10 lg:px-6 space-y-4">
        <div className="h-4 w-32 rounded-full bg-white/10" />
        <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-6 shadow-2xl shadow-emerald-500/10 backdrop-blur space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-white/10" />
              <div className="space-y-2">
                <div className="h-3 w-32 rounded-full bg-white/10" />
                <div className="h-3 w-48 rounded-full bg-white/10" />
              </div>
            </div>
            <div className="h-6 w-32 rounded-full bg-emerald-500/15" />
          </div>
          <div className="h-6 w-3/4 rounded-full bg-white/10" />
          <div className="h-4 w-full rounded-full bg-white/10" />
          <div className="h-4 w-2/3 rounded-full bg-white/10" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-emerald-500/15">
            <div className="h-3 w-40 rounded-full bg-white/10" />
            <div className="h-2 w-full rounded-full bg-white/10" />
            <div className="h-2 w-full rounded-full bg-white/10" />
            <div className="h-2 w-5/6 rounded-full bg-white/10" />
          </div>
          <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-emerald-500/15">
            <div className="h-3 w-32 rounded-full bg-white/10" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((k) => (
                <div key={k} className="h-16 rounded-xl border border-white/10 bg-white/5" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
