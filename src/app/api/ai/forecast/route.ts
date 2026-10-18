import { NextResponse } from "next/server";
import { forecastSurplus, type ForecastInput } from "@/lib/oci-service";
import { NO_SHOW, WEATHER } from "@/lib/forecast";

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<ForecastInput>;
  const rsvps = Math.max(0, Number(body.rsvps) || 0);
  const foodOrdered = Math.max(0, Number(body.foodOrdered) || 0);
  const eventType = body.eventType && body.eventType in NO_SHOW ? body.eventType : "Other";
  const weather = body.weather && body.weather in WEATHER ? body.weather : "Clear";
  return NextResponse.json(await forecastSurplus({ rsvps, foodOrdered, eventType, weather }));
}
