import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/public-data/census";
import { areaNeed, tractAccess } from "@/lib/public-data/foodAccess";
import { attempt } from "@/lib/public-data/http";

/** Address → coordinates and census tract (Census Geocoder) → food-access need (USDA Food Access Research Atlas). */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address")?.trim().slice(0, 200);
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });
  const geo = await attempt("U.S. Census Geocoder", () => geocodeAddress(address));
  if (!geo.ok || !geo.data) return NextResponse.json({ geo, access: null });
  const tract = geo.data.tract;
  const access = tract ? await attempt("USDA Food Access Research Atlas", () => tractAccess(tract)) : null;
  const need = access?.ok && access.data ? areaNeed(access.data) : null;
  return NextResponse.json({ geo, access, need });
}
