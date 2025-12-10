import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_ROOT =
  process.env.DATA_DIR ??
  (process.env.VERCEL ? "/tmp/futuravote" : path.join(process.cwd(), "data"));
const IMAGES_DIR = path.join(DATA_ROOT, "images");

export const revalidate = 0;

export async function GET(
  _request: Request,
  props: { params: Promise<{ filename: string }> }
) {
  const { filename } = await props.params;
  const safeName = path.basename(filename);
  const fullPath = path.join(IMAGES_DIR, safeName);

  if (!fs.existsSync(fullPath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stream = fs.createReadStream(fullPath);
  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

