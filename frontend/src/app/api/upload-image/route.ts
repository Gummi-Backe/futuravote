import { randomUUID } from "crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/app/lib/supabaseServerClient";

const IMAGE_BUCKET = process.env.SUPABASE_IMAGE_BUCKET || "question-images";

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

    // Bild vor dem Upload auf eine kleine, einheitliche Größe verkleinern
    const resized = await sharp(buffer)
      // Maximal ca. 250x150 Pixel, Seitenverhältnis bleibt erhalten
      .resize(250, 150, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
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
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Image upload/resize failed", error);
    return NextResponse.json(
      { error: "Bild konnte nicht verarbeitet werden." },
      { status: 500 }
    );
  }
}

