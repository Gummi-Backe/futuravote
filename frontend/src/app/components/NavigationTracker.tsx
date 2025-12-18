"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/app/lib/analytics";

const NAV_STACK_KEY = "fv_nav_stack_v1";
const MAX_STACK = 20;

function getCurrentUrl(pathname: string, searchParams: URLSearchParams | null) {
  const qs = searchParams?.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const url = getCurrentUrl(pathname, searchParams);
    if (lastUrlRef.current === url) return;
    lastUrlRef.current = url;

    try {
      const raw = window.sessionStorage.getItem(NAV_STACK_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const stack = Array.isArray(parsed) ? (parsed.filter((v) => typeof v === "string") as string[]) : [];

      if (stack[stack.length - 1] === url) return;

      const existingIndex = stack.lastIndexOf(url);
      const next =
        existingIndex >= 0 ? stack.slice(0, existingIndex + 1) : [...stack, url];

      window.sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(next.slice(-MAX_STACK)));
    } catch {
      // ignore
    }

    trackEvent("page_view", { url });
  }, [pathname, searchParams]);

  return null;
}

export function canGoBackInternally(): boolean {
  try {
    const raw = window.sessionStorage.getItem(NAV_STACK_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const stack = Array.isArray(parsed) ? (parsed.filter((v) => typeof v === "string") as string[]) : [];
    return stack.length > 1;
  } catch {
    return false;
  }
}
