import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) redirect("/auth");

  const user = await getUserBySessionSupabase(sessionId).catch(() => null);
  if (!user || user.role !== "admin") redirect("/");

  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-8 lg:px-6">
        <AnalyticsClient />
      </div>
    </main>
  );
}

