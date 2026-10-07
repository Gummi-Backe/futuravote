import { getMcpConfig, protectedResourceMetadata } from "@/app/lib/mcpConfig";

export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(protectedResourceMetadata(getMcpConfig()), { headers: { "Cache-Control": "no-store" } });
}
