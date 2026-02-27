"use client";

import { useEffect, useState } from "react";

export function ZoomableImage(props: {
  src: string;
  alt: string;
  title?: string;
  loading?: "eager" | "lazy";
  thumbWrapperClassName?: string;
  thumbImageClassName?: string;
}) {
  const { src, alt, title, loading = "lazy", thumbWrapperClassName, thumbImageClassName } = props;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${thumbWrapperClassName ?? ""} cursor-zoom-in`}
        aria-label="Bild groß anzeigen"
        title={title ?? "Bild groß anzeigen"}
      >
        <img
          src={src}
          alt={alt}
          loading={loading}
          className={thumbImageClassName}
        />
      </button>

      {open ? (
        <div
          className="overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[92vh] max-w-[96vw]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 z-10 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-xs font-semibold text-white hover:border-white/45"
              aria-label="Vorschau schließen"
            >
              Schließen
            </button>
            <img
              src={src}
              alt={alt}
              className="max-h-[90vh] max-w-[95vw] rounded-2xl border border-white/15 bg-black/30 object-contain shadow-2xl shadow-black/70"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

