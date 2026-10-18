import { NextResponse } from "next/server";
import { NETWORK_CENTER } from "@/lib/auth";
import { predictSurplus } from "@/lib/forecast";
import { geocodeAddress } from "@/lib/public-data/census";
import { weatherOn } from "@/lib/public-data/weather";
import { scoutEvents } from "@/lib/scout";

/**
 * Simulated event feed, enriched with real public data: each venue is geocoded (Census Geocoder)
 * (falling back to the city center) and its event-day forecast (Open-Meteo) adjusts the no-show model. Enrichment failures fall back
 * to clear weather so the feed never breaks.
 */
export async function GET() {
  const events = await Promise.all(
    scoutEvents().map(async (e) => {
      try {
        // Venues the Census geocoder can't match still get city-level weather.
        const geo = await geocodeAddress(e.address).catch(() => null);
        const day = await weatherOn(geo?.lat ?? NETWORK_CENTER.lat, geo?.lng ?? NETWORK_CENTER.lng, e.start.slice(0, 10));
        if (!day) return { ...e, weather: null };
        const f = predictSurplus({ rsvps: e.attendees, foodOrdered: e.cateringPortions, eventType: e.eventType, weather: day.weather });
        return { ...e, predictedSurplus: f.surplus, confidence: f.confidence, weather: { factor: day.weather, summary: day.summary }, lat: geo?.lat, lng: geo?.lng };
      } catch {
        return { ...e, weather: null };
      }
    }),
  );
  return NextResponse.json({ events: events.sort((a, b) => b.predictedSurplus - a.predictedSurplus), simulated: true, enrichedWith: ["U.S. Census Geocoder", "Open-Meteo"] });
}
