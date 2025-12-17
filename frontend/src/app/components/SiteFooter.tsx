import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="fv-site-footer border-t border-white/10 bg-slate-950/70 px-4 py-6 text-xs text-slate-300 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/regeln" className="hover:text-emerald-100">
            Regeln
          </Link>
          <Link href="/archiv" className="hover:text-emerald-100">
            Archiv
          </Link>
          <Link href="/terms" className="hover:text-emerald-100">
            Nutzungsbedingungen
          </Link>
          <Link href="/datenschutz" className="hover:text-emerald-100">
            Datenschutz
          </Link>
          <Link href="/impressum" className="hover:text-emerald-100">
            Impressum
          </Link>
        </nav>

        <div className="text-[11px] text-slate-500">Future‑Vote</div>
      </div>
    </footer>
  );
}
