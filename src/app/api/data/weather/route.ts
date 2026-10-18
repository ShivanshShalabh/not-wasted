import { NextResponse } from "next/server";
import { NETWORK_CENTER } from "@/lib/auth";
import { attempt } from "@/lib/public-data/http";
import { weatherOn } from "@/lib/public-data/weather";

/** Event-day weather from Open-Meteo, mapped to the surplus forecast's weather factor. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const date = q.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const lat = Number(q.get("lat")) || NETWORK_CENTER.lat;
  const lng = Number(q.get("lng")) || NETWORK_CENTER.lng;
  return NextResponse.json(await attempt("Open-Meteo", () => weatherOn(lat, lng, date)));
}
