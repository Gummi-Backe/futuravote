import { ImageResponse } from "next/og";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de").replace(/\/+$/, "");

function safeColor(value?: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#10b981";
}

function titleSize(title: string): number {
  if (title.length > 125) return 39;
  if (title.length > 95) return 44;
  if (title.length > 70) return 49;
  return 55;
}

function absoluteImageUrl(value?: string): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw, SITE_URL).toString();
  } catch {
    return null;
  }
}

async function imageDataUrl(value?: string): Promise<string | null> {
  const url = absoluteImageUrl(value);
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return null;
    const contentTypeHeader = response.headers.get("content-type")?.split(";", 1)[0]?.trim() || "";
    if (!contentTypeHeader.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) return null;
    return `data:${contentTypeHeader};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image(props: { params: Promise<{ id: string }> | { id: string } }) {
  const params = await props.params;
  const question = await getQuestionByIdFromSupabase(params.id ?? "").catch(() => null);
  const isPublic = question?.visibility !== "link_only" && !question?.isQuarantined;
  const title = isPublic ? question?.title?.trim() || "Aktuelle Umfrage" : "Aktuelle Umfrage";
  const category = isPublic ? question?.category?.trim() || "FutureVote" : "FutureVote";
  const categoryIcon = isPublic ? question?.categoryIcon?.trim() || "FV" : "FV";
  const categoryColor = safeColor(isPublic ? question?.categoryColor : undefined);
  const pollType = isPublic && question?.isResolvable === false ? "Meinungs-Umfrage" : "Prognose";
  const sourceImage = isPublic ? await imageDataUrl(question?.imageUrl) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#07100d",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          letterSpacing: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 12,
            display: "flex",
            background: categoryColor,
          }}
        />

        <div
          style={{
            width: sourceImage ? 720 : 1200,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "54px 58px 48px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                border: "1px solid rgba(167,243,208,0.35)",
                background: "rgba(16,185,129,0.18)",
                color: "#d1fae5",
                fontSize: 21,
                fontWeight: 800,
              }}
            >
              FV
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>FutureVote</div>
              <div style={{ fontSize: 15, color: "#94a3b8" }}>future-vote.de</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 19 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  padding: "9px 14px",
                  border: `1px solid ${categoryColor}`,
                  background: "rgba(255,255,255,0.06)",
                  fontSize: 16,
                  fontWeight: 750,
                }}
              >
                <span>{categoryIcon}</span>
                <span>{category}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  borderRadius: 999,
                  padding: "9px 14px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#e2e8f0",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {pollType}
              </div>
            </div>
            <div
              style={{
                maxWidth: sourceImage ? 610 : 1020,
                fontSize: titleSize(title),
                lineHeight: 1.08,
                fontWeight: 850,
                letterSpacing: 0,
              }}
            >
              {title}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#cbd5e1", fontSize: 19 }}>
            <span style={{ color: "#6ee7b7", fontWeight: 800 }}>Jetzt abstimmen</span>
            <span>·</span>
            <span>Community-Ergebnis live verfolgen</span>
          </div>
        </div>

        {sourceImage ? (
          <div
            style={{
              width: 480,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderLeft: "1px solid rgba(255,255,255,0.14)",
              background: "#020706",
              padding: 30,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sourceImage}
              alt=""
              style={{ width: 420, height: 420, objectFit: "contain", borderRadius: 8 }}
            />
          </div>
        ) : null}
      </div>
    ),
    size
  );
}
