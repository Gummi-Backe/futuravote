export default function Loading() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-8 w-40 rounded-full bg-white/10 animate-pulse" />
        <div className="h-40 w-full rounded-3xl bg-white/10 animate-pulse" />
        <div className="h-40 w-full rounded-3xl bg-white/10 animate-pulse" />
      </div>
    </main>
  );
}

