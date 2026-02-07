"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { categories } from "@/app/data/mock";
import type { LeaderboardView } from "@/app/data/leaderboards";

function buildHref(view: LeaderboardView, nextCategory: string) {
  const params = new URLSearchParams();
  if (view !== "treffer") params.set("view", view);
  if (nextCategory && nextCategory !== "all") params.set("category", nextCategory);
  const qs = params.toString();
  return qs ? `/rangliste?${qs}` : "/rangliste";
}

function getPxWidth(el: Element | null) {
  if (!el) return 0;
  return Math.ceil(el.getBoundingClientRect().width);
}

function getGapPx(container: HTMLElement) {
  const style = window.getComputedStyle(container);
  const raw = style.columnGap || style.gap || "0";
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Math.ceil(parsed) : 0;
}

function cssEscape(value: string) {
  // `CSS.escape` exists in modern browsers but not all TS DOM libs type it.
  // Fall back to a conservative escape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const css: any = (globalThis as any).CSS;
  if (css && typeof css.escape === "function") return css.escape(value);
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function CategorySelectorRowClient({
  category,
  view,
  className,
}: {
  category: string;
  view: LeaderboardView;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleLabels, setVisibleLabels] = useState<string[]>([]);
  const [hiddenLabels, setHiddenLabels] = useState<string[]>([]);

  const activeCategoryLabel = category?.trim() || "all";

  const baseLinkClass =
    "inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition";
  const activeLinkClass = "border-emerald-300/60 bg-emerald-500/25 text-white hover:-translate-y-0.5";
  const inactiveLinkClass =
    "border-white/10 bg-white/5 text-slate-100 hover:-translate-y-0.5 hover:border-emerald-200/40";

  const overflow = useMemo(() => {
    const hidden = new Set(hiddenLabels);
    return categories.filter((cat) => hidden.has(cat.label));
  }, [hiddenLabels]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const recompute = () => {
      const availablePx = Math.floor(container.clientWidth);
      if (availablePx <= 0) return;

      const gapPx = getGapPx(container);
      const allWidth = getPxWidth(measure.querySelector('[data-measure="all"]'));
      const dotsWidth = getPxWidth(measure.querySelector('[data-measure="dots"]'));

      const getCatWidth = (label: string) =>
        getPxWidth(measure.querySelector(`[data-measure-cat="${cssEscape(label)}"]`));

      const reserveForDots = dotsWidth + gapPx; // keep "..." always visible with one gap
      let used = allWidth;
      const nextVisible: string[] = [];
      const nextHidden: string[] = [];

      for (const cat of categories) {
        const w = getCatWidth(cat.label);
        // strict fit: if a chip does not fully fit, move it to overflow
        if (used + gapPx + w + reserveForDots <= availablePx) {
          nextVisible.push(cat.label);
          used += gapPx + w;
          continue;
        }
        nextHidden.push(cat.label);
      }

      setVisibleLabels((prevVisible) => {
        if (
          prevVisible.length === nextVisible.length &&
          prevVisible.every((value, index) => value === nextVisible[index])
        ) {
          return prevVisible;
        }
        return nextVisible;
      });
      setHiddenLabels((prevHidden) => {
        if (
          prevHidden.length === nextHidden.length &&
          prevHidden.every((value, index) => value === nextHidden[index])
        ) {
          return prevHidden;
        }
        return nextHidden;
      });
    };

    recompute();
    const ro = new ResizeObserver(() => recompute());
    ro.observe(container);

    const fonts = "fonts" in document ? (document.fonts as FontFaceSet | undefined) : undefined;
    let disposed = false;

    const schedule = () => {
      if (disposed) return;
      // Let layout and late font swaps settle.
      requestAnimationFrame(() => {
        if (disposed) return;
        recompute();
      });
    };

    if (fonts?.ready) {
      fonts.ready.then(schedule).catch(() => undefined);
    }

    const onFontsDone = () => schedule();
    fonts?.addEventListener?.("loadingdone", onFontsDone);
    fonts?.addEventListener?.("loadingerror", onFontsDone);

    return () => {
      disposed = true;
      fonts?.removeEventListener?.("loadingdone", onFontsDone);
      fonts?.removeEventListener?.("loadingerror", onFontsDone);
      ro.disconnect();
    };
  }, []);

  const visibleCategories = useMemo(() => {
    // Preserve original category order; rendering follows `visibleLabels` sequence.
    const map = new Map(categories.map((c) => [c.label, c]));
    return visibleLabels.map((label) => map.get(label)).filter(Boolean) as (typeof categories)[number][];
  }, [visibleLabels]);

  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] -top-[9999px] opacity-0">
        <div ref={measureRef} className="flex flex-nowrap items-center gap-2">
          <span data-measure="all" className={baseLinkClass}>
            Alle
          </span>
          {categories.map((cat) => (
            <span key={cat.label} data-measure-cat={cat.label} className={baseLinkClass}>
              <span aria-hidden="true">{cat.icon}</span>
              <span>{cat.label}</span>
            </span>
          ))}
          <span
            data-measure="dots"
            className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-100"
          >
            ...
          </span>
        </div>
      </div>

      <div ref={containerRef} className="flex flex-nowrap items-center gap-2">
        <Link
          href={buildHref(view, "all")}
          replace
          scroll={false}
          className={`${baseLinkClass} ${activeCategoryLabel === "all" ? activeLinkClass : inactiveLinkClass}`}
        >
          Alle
        </Link>

        {visibleCategories.map((cat) => {
          const isActive = activeCategoryLabel === cat.label;
          return (
            <Link
              key={cat.label}
              href={buildHref(view, cat.label)}
              replace
              scroll={false}
              className={`${baseLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}
            >
              <span aria-hidden="true">{cat.icon}</span>
              <span>{cat.label}</span>
            </Link>
          );
        })}

        <details className="relative shrink-0">
          <summary className="inline-flex list-none h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-200/40">
            ...
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-[20rem] max-w-[85vw] rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Weitere Kategorien</p>
            {overflow.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">Alle Kategorien sind bereits sichtbar.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {overflow.map((cat) => {
                  const isActive = activeCategoryLabel === cat.label;
                  return (
                    <Link
                      key={cat.label}
                      href={buildHref(view, cat.label)}
                      replace
                      scroll={false}
                      className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        isActive
                          ? "border-emerald-300/60 bg-emerald-500/25 text-white"
                          : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40"
                      }`}
                    >
                      <span aria-hidden="true">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
