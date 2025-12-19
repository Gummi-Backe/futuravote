import { TermsContent } from "./TermsContent";
import { SmartBackButton } from "@/app/components/SmartBackButton";

export const metadata = {
  title: "Nutzungsbedingungen - Future-Vote",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-16 pt-10 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <SmartBackButton
          fallbackHref="/"
          label="← Zurück"
          className="self-start text-sm text-emerald-100 hover:text-emerald-200"
        />

        <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <TermsContent />
        </section>
      </div>
    </main>
  );
}
