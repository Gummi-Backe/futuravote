import { serveMcpOAuth } from "@/app/lib/mcpServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return serveMcpOAuth(request, "authorize"); }
export const POST = GET;
