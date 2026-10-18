import { NextResponse } from "next/server";
import { extractEvent } from "@/lib/oci-service";

export async function POST(req: Request) {
  const body = (await req.json()) as { imageBase64?: string; mimeType?: string };
  if (!body.imageBase64) return NextResponse.json({ error: "Missing screenshot" }, { status: 400 });
  if (body.imageBase64.length > 7_000_000) return NextResponse.json({ error: "Image too large (max ~5 MB)" }, { status: 413 });
  return NextResponse.json(await extractEvent({ imageBase64: body.imageBase64, mimeType: body.mimeType ?? "image/png" }));
}
