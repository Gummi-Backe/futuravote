import type { Metadata } from "next";
import { SmartBackButton } from "@/app/components/SmartBackButton";
import { FeedbackClient } from "./FeedbackClient";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Feedback oder Bugs melden – mit Seitenkontext.",
  alternates: { canonical: "/feedback" },
};

export default function FeedbackPage() {
  return (
    <main className="page-enter px-4 pb-16 pt-6">
      <div className="mx-auto max-w-3xl">
        <SmartBackButton
          fallbackHref="/"
          label="Zurück"
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
        />

        <header className="mt-4 rounded-3xl border border-white/10 bg-white/10 px-4 py-5 shadow-2xl shadow-emerald-500/10 backdrop-blur sm:px-6">
          <h1 className="text-2xl font-bold text-white">Feedback / Bug melden</h1>
          <p className="mt-2 text-sm text-slate-300">
            Wenn etwas nicht funktioniert oder du eine Idee hast: schick mir kurz Feedback. Die Seite (URL) und dein Browser werden
            automatisch ergänzt – so kann ich das Problem schneller nachstellen.
          </p>
        </header>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl shadow-emerald-500/10 backdrop-blur sm:p-6">
          <FeedbackClient />
        </section>
      </div>
    </main>
  );
}

