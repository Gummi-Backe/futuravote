import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getAdminSettings } from "@/app/lib/adminSettings";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) redirect("/auth");

  const user = await getUserBySessionSupabase(sessionId).catch(() => null);
  if (!user || user.role !== "admin") redirect("/");

  const settings = await getAdminSettings();

  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-8 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Einstellungen</h1>
            <p className="mt-1 text-sm text-slate-300">Schwellwerte für Moderation und Community-Review.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-emerald-100 hover:text-emerald-200">
              ← Admin
            </Link>
            <Link href="/" className="text-sm text-emerald-100 hover:text-emerald-200">
              Zur Startseite
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <SettingsClient initial={settings} />
        </div>
      </div>
    </main>
  );
}

