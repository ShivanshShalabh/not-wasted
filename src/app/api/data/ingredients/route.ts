import { NextResponse } from "next/server";
import { attempt } from "@/lib/public-data/http";
import { searchFoods } from "@/lib/public-data/usda";

/** Typical ingredients and likely allergens for a dish name, from USDA FoodData Central. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80);
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  return NextResponse.json(await attempt("USDA FoodData Central", () => searchFoods(q)));
}
