import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { ProfileRegionForm } from "./ProfileRegionForm";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    redirect("/auth");
  }

  const user = await getUserBySessionSupabase(sessionId);
  if (!user) {
    redirect("/auth");
  }

  let createdLabel = "unbekannt";
  if (user.createdAt) {
    const date = new Date(user.createdAt);
    if (!Number.isNaN(date.getTime())) {
      createdLabel = date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  }

  return (
    <main className="page-enter min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-10">
        <Link href="/" className="self-start text-sm text-emerald-100 hover:text-emerald-200">
          &larr; Zurück zum Feed
        </Link>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Dein Profil</h1>
          <p className="mt-1 text-sm text-slate-300">
            Hier siehst du die wichtigsten Daten zu deinem Future-Vote-Account.
          </p>

          <div className="mt-4 space-y-3 text-sm text-slate-100">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Anzeige-Name</span>
              <span className="font-semibold text-white">{user.displayName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">E-Mail</span>
              <span className="truncate font-medium text-slate-50">{user.email}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Rolle</span>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                {user.role === "admin" ? "Admin" : "User"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Registriert seit</span>
              <span className="font-medium text-slate-100">{createdLabel}</span>
            </div>
          </div>

          <ProfileRegionForm initialRegion={user.defaultRegion ?? null} />

          <div className="mt-5 rounded-2xl bg-black/30 px-3 py-2 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">Ausblick</p>
            <p>
              In einer späteren Version können hier auch einfache Statistiken angezeigt werden, z. B. wie viele Fragen
              du vorgeschlagen hast, wie viele davon angenommen wurden oder wie aktiv du im Review-Bereich bist.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

