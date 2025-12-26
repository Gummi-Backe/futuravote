"use client";

import { useRouter } from "next/navigation";
import { canGoBackInternally } from "./NavigationTracker";

export function SmartBackButton({
  fallbackHref,
  label = "Zurück",
  className = "",
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const defaultClassName =
    "inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60 active:translate-y-0";
  const resolvedClassName = className.trim().length > 0 ? className : defaultClassName;

  return (
    <button
      type="button"
      className={resolvedClassName}
      onClick={() => {
        if (typeof window !== "undefined" && canGoBackInternally()) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      {label}
    </button>
  );
}
