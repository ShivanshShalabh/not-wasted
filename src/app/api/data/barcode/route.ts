import { NextResponse } from "next/server";
import { attempt } from "@/lib/public-data/http";
import { productByBarcode } from "@/lib/public-data/openFoodFacts";

/** Packaged-food lookup by barcode from Open Food Facts. */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code")?.replace(/\D/g, "") ?? "";
  if (code.length < 8) return NextResponse.json({ error: "Enter an 8–14 digit barcode" }, { status: 400 });
  return NextResponse.json(await attempt("Open Food Facts", () => productByBarcode(code)));
}
