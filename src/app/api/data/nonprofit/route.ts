import { NextResponse } from "next/server";
import { attempt } from "@/lib/public-data/http";
import { searchNonprofits } from "@/lib/public-data/nonprofits";

/** Nonprofit verification against IRS exempt-organization data via ProPublica Nonprofit Explorer. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const name = q.get("name")?.trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  return NextResponse.json(await attempt("ProPublica Nonprofit Explorer (IRS data)", () => searchNonprofits(name, (q.get("state") ?? "TN").slice(0, 2).toUpperCase())));
}
