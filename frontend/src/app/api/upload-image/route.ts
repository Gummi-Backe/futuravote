import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { NextResponse } from "next/server";

const DATA_ROOT =
  process.env.DATA_DIR ??
  (process.env.VERCEL ? "/tmp/futuravote" : path.join(process.cwd(), "data"));
const IMAGES_DIR = path.join(DATA_ROOT, "images");

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

export const revalidate = 0;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Bilddatei erhalten." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const id = randomUUID();
    const targetFilename = `${id}.jpg`;
    const targetPath = path.join(IMAGES_DIR, targetFilename);

    const resized = await sharp(buffer)
      // Maximal ca. 250×150 Pixel, Seitenverhältnis bleibt erhalten
      .resize(250, 150, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    await fs.promises.writeFile(targetPath, resized);

    const imageUrl = `/api/images/${targetFilename}`;
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Image upload/resize failed", error);
    return NextResponse.json(
      { error: "Bild konnte nicht verarbeitet werden." },
      { status: 500 }
    );
  }
}
