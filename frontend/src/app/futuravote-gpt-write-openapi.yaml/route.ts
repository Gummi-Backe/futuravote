import { GET as getWriteOpenApi } from "@/app/api/gpt/openapi/write/route";

export function GET() {
  return getWriteOpenApi();
}
