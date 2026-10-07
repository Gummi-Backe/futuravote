import { serveMcp } from "@/app/lib/mcpServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const POST = serveMcp;

export function GET() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
export const DELETE = GET;
