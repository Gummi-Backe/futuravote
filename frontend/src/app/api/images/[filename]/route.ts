import fs from "fs";
import path from "path";
import { Readable } from "stream";
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
  const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
