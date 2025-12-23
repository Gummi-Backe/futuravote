import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const dynamic = "force-dynamic";

type HealthResult = { ok: boolean; label: string; detail?: string; href: string };

async function getOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function fetchHealth(href: string, label: string): Promise<HealthResult> {
  try {
    const origin = await getOrigin();
    const res = await fetch(`${origin}${href}`, { cache: "no-store" });
    const json: any = await res.json().catch(() => null);
    const ok = Boolean(res.ok && json && json.ok === true);
    const detail =
      typeof json?.note === "string"
        ? json.note
        : typeof json?.questionsInSupabase === "number"
          ? `questionsInSupabase: ${json.questionsInSupabase}`
          : undefined;
    return { ok, label, detail, href };
  } catch {
    return { ok: false, label, detail: "nicht erreichbar", href };
  }
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-50"
          : "rounded-full border border-rose-300/30 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-50"
      }
    >
      {ok ? "OK" : "Fehler"}
    </span>
  );
}

function Card({
  title,
  desc,
  href,
  action,
}: {
  title: string;
  desc: string;
  href: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-white/10 bg-black/20 p-4 shadow-md shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-200/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-slate-300">{desc}</div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition group-hover:border-emerald-200/30">
          {action}
        </span>
      </div>
    </Link>
  );
}

function HealthCard({ result }: { result: HealthResult }) {
  return (
    <a
      href={result.href}
      target="_blank"
      rel="noreferrer"
      className="group rounded-3xl border border-white/10 bg-black/20 p-4 shadow-md shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-200/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-white">{result.label}</div>
            <StatusPill ok={result.ok} />
          </div>
          <div className="mt-1 text-sm text-slate-300">{result.detail ?? "Öffnet JSON im neuen Tab."}</div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition group-hover:border-emerald-200/30">
          Öffnen
        </span>
      </div>
    </a>
  );
}

export default async function AdminHomePage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) redirect("/auth");

  const user = await getUserBySessionSupabase(sessionId).catch(() => null);
  if (!user || user.role !== "admin") redirect("/");

  const [healthSupabase, healthRls] = await Promise.all([
    fetchHealth("/api/health/supabase", "Healthcheck: Supabase"),
    fetchHealth("/api/health/rls", "Healthcheck: RLS/Policies"),
  ]);

  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-8 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin</h1>
            <p className="mt-1 text-sm text-slate-300">Moderation, Monitoring und Kennzahlen.</p>
          </div>
          <Link href="/" className="text-sm text-emerald-100 hover:text-emerald-200">
            Zur Startseite
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Card title="Meldungen" desc="Gemeldete Inhalte prüfen und moderieren." href="/admin/reports" action="Öffnen" />
          <Card title="Analytics" desc="Basis-Kennzahlen (7 Tage) ohne IP/E-Mail." href="/admin/analytics" action="Öffnen" />
          <Card title="Auflösungen" desc="KI-Vorschläge für abgelaufene Fragen prüfen." href="/admin/resolutions" action="Öffnen" />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <HealthCard result={healthSupabase} />
          <HealthCard result={healthRls} />
        </div>
      </div>
    </main>
  );
}
