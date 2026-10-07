import { serveMcpOAuth } from "@/app/lib/mcpServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return serveMcpOAuth(request, "token"); }
