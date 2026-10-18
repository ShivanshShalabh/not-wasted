import { NextResponse } from "next/server";
import { evaluateItems, type EvaluateInput } from "@/lib/oci-service";
import { CATEGORY_LIST } from "@/lib/categories";

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<EvaluateInput>;
  if (!body.category || (body.category !== "auto" && !CATEGORY_LIST.includes(body.category)))
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  if (body.imageBase64 && body.imageBase64.length > 7_000_000)
    return NextResponse.json({ error: "Image too large (max ~5 MB)" }, { status: 413 });
  return NextResponse.json(
    await evaluateItems({ category: body.category, description: String(body.description ?? ""), imageBase64: body.imageBase64, mimeType: body.mimeType, fileName: body.fileName }),
  );
}
