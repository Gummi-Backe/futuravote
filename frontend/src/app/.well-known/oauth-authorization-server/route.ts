import { getMcpConfig, authorizationServerMetadata } from "@/app/lib/mcpConfig";

export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(authorizationServerMetadata(getMcpConfig()), { headers: { "Cache-Control": "no-store" } });
}
