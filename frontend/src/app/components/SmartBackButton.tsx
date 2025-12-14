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

  return (
    <button
      type="button"
      className={className}
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

