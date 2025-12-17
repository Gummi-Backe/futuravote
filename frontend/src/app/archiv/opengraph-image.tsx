import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0b1220 0%, #07131d 35%, #061826 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(16,185,129,0.18)",
              border: "1px solid rgba(167,243,208,0.35)",
              boxShadow: "0 18px 40px rgba(16,185,129,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            FV
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "rgba(226,232,240,0.95)" }}>
            Future-Vote
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 60, lineHeight: 1.05, fontWeight: 800, letterSpacing: -1 }}>
            Archiv &amp; Statistiken
          </div>
          <div style={{ fontSize: 26, lineHeight: 1.25, color: "rgba(226,232,240,0.85)", maxWidth: 900 }}>
            Transparente Plattform-Metriken und beendete Umfragen – inklusive Ergebnis zum Endzeitpunkt.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                fontSize: 16,
                fontWeight: 700,
                color: "rgba(248,250,252,0.9)",
              }}
            >
              Seriös. Transparent. Deutsch.
            </div>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid rgba(167,243,208,0.35)",
                background: "rgba(16,185,129,0.14)",
                fontSize: 16,
                fontWeight: 700,
                color: "rgba(236,253,245,0.95)",
              }}
            >
              future-vote.de/archiv
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 16, color: "rgba(148,163,184,0.9)" }}>
            Öffentliche Fragen · Stimmen · Kategorien · Erfolgsquote
          </div>
          <div style={{ fontSize: 16, color: "rgba(148,163,184,0.9)" }}>Teilen-Vorschau (OpenGraph)</div>
        </div>
      </div>
    ),
    size
  );
}
