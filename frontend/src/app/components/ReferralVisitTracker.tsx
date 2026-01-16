"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function stripReferralParam(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete("fv_ref");
  return next;
}

export function ReferralVisitTracker() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const ref = searchParams?.get("fv_ref") ?? null;
  const path = useMemo(() => {
    if (!pathname) return null;
    const qs = searchParams ? searchParams.toString() : "";
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!ref || !path || !pathname) return;

    const cleanParams = searchParams ? stripReferralParam(searchParams) : null;
    const cleanUrl = cleanParams ? `${pathname}${cleanParams.toString() ? `?${cleanParams.toString()}` : ""}` : pathname;

    void fetch("/api/referrals/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, path }),
      keepalive: true,
    }).finally(() => {
      try {
        router.replace(cleanUrl, { scroll: false });
      } catch {
        // ignore
      }
    });
  }, [path, pathname, ref, router, searchParams]);

  return null;
}

