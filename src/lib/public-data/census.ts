import "server-only";
import { fetchJson } from "./http";

/** U.S. Census Bureau Geocoder (public, no key): address → coordinates + 2020 census tract. */
export interface Geocode { lat: number; lng: number; matchedAddress: string; tract?: string }

interface CensusResponse {
  result?: { addressMatches?: Array<{ matchedAddress: string; coordinates: { x: number; y: number }; geographies?: Record<string, Array<{ GEOID: string }>> }> };
}

export function parseGeocode(d: CensusResponse): Geocode | null {
  const m = d.result?.addressMatches?.[0];
  if (!m) return null;
  return { lat: m.coordinates.y, lng: m.coordinates.x, matchedAddress: m.matchedAddress, tract: m.geographies?.["Census Tracts"]?.[0]?.GEOID };
}

export async function geocodeAddress(address: string): Promise<Geocode | null> {
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Census%20Tracts&format=json`;
  return parseGeocode(await fetchJson<CensusResponse>(url, { ttlMs: 7 * 24 * 3600_000, timeoutMs: 15_000 }));
}
