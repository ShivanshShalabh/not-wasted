import "server-only";
import type { Weather } from "../forecast";
import { fetchJson } from "./http";

/** Open-Meteo daily forecast (public, no key, ~16 days ahead) mapped onto the surplus model's weather factor. */
export interface DayWeather { date: string; weather: Weather; code: number; tempMaxC: number; precipProbability: number; summary: string }

const WMO: Record<number, string> = { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers", 85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm, hail", 99: "Thunderstorm, hail" };

export function classify(code: number, tempMaxC: number, precipProbability: number): Weather {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if (code >= 51 || precipProbability >= 60) return "Rain";
  if (tempMaxC >= 33) return "Heat";
  return "Clear";
}

interface OpenMeteoDaily { daily?: { time: string[]; weathercode: number[]; temperature_2m_max: number[]; precipitation_probability_max: (number | null)[] } }

export function parseDay(d: OpenMeteoDaily, date: string): DayWeather | null {
  const i = d.daily?.time.indexOf(date) ?? -1;
  if (!d.daily || i < 0) return null;
  const code = d.daily.weathercode[i];
  const tempMaxC = d.daily.temperature_2m_max[i];
  const precipProbability = d.daily.precipitation_probability_max[i] ?? 0;
  return { date, code, tempMaxC, precipProbability, weather: classify(code, tempMaxC, precipProbability), summary: `${WMO[code] ?? "Mixed"}, high ${Math.round(tempMaxC)}°C, ${precipProbability}% chance of rain` };
}

export async function weatherOn(lat: number, lng: number, date: string): Promise<DayWeather | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&daily=weathercode,temperature_2m_max,precipitation_probability_max&forecast_days=16&timezone=America%2FChicago`;
  return parseDay(await fetchJson<OpenMeteoDaily>(url, { ttlMs: 30 * 60_000 }), date);
}
