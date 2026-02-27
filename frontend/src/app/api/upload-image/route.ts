import { randomUUID } from "crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/app/lib/supabaseServerClient";

const IMAGE_BUCKET = process.env.SUPABASE_IMAGE_BUCKET || "question-images";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif", "image/gif"]);

export const revalidate = 0;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Bilddatei erhalten." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Die Datei ist leer." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Die Datei ist zu groß. Bitte wähle ein kleineres Bild (max. 8 MB)." },
      { status: 413 }
    );
  }

  const fileType = file.type || "";
  if (!ALLOWED_MIME_TYPES.has(fileType)) {
    const shownType = fileType || "unbekannt";
    return NextResponse.json(
      { error: `Ungültiges Bildformat (${shownType}). Bitte nutze JPG, PNG oder WebP.` },
      { status: 415 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const id = randomUUID();
    const targetFilename = `${id}.jpg`;

    const metadata = await sharp(buffer).metadata();
    const sourceWidth = Number(metadata.width ?? 0);
    const sourceHeight = Number(metadata.height ?? 0);
    const isLandscape = sourceWidth > sourceHeight;
    const isPortrait = sourceHeight > sourceWidth;

    const targetWidth = isLandscape ? 512 : isPortrait ? 300 : 512;
    const targetHeight = isLandscape ? 300 : isPortrait ? 512 : 512;

    // Einheitliches Ausgabeformat je Ausrichtung:
    // Querformat: 512x300 | Hochformat: 300x512 | Quadrat: 512x512
    const resized = await sharp(buffer)
      .rotate()
      .resize(targetWidth, targetHeight, { fit: "cover", position: "centre" })
      .jpeg({ quality: 82 })
      .toBuffer();

    const supabase = getSupabaseServerClient();

    const pathInBucket = `questions/${targetFilename}`;
    const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(pathInBucket, resized, {
      contentType: "image/jpeg",
      upsert: false,
    });

    if (uploadError) {
      console.error("Supabase Storage upload failed", uploadError);
      return NextResponse.json(
        { error: "Bild konnte nicht in den Bildspeicher hochgeladen werden." },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(pathInBucket);

    const imageUrl = publicUrl;
    return NextResponse.json({ imageUrl, width: targetWidth, height: targetHeight });
  } catch (error) {
    console.error("Image upload/resize failed", error);
    return NextResponse.json(
      { error: "Bild konnte nicht verarbeitet werden." },
      { status: 500 }
    );
  }
}

