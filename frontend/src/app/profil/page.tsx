import { headers } from "next/headers";
import { ProfilClient } from "./ProfilClient";

async function getBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (process.env.NODE_ENV !== "production" && envBaseUrl) {
    return envBaseUrl;
  }
  if (host) return `${protocol}://${host}`;
  return envBaseUrl ?? "http://localhost:3000";
}

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const baseUrl = await getBaseUrl();
  return <ProfilClient baseUrl={baseUrl} />;
}

