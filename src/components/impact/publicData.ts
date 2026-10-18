"use client";

import { useEffect, useState } from "react";
import type { EpaGenerator, EpaRecipient } from "@/lib/public-data/epa";
import type { RecipientOrg } from "@/lib/types";

export type { EpaGenerator, EpaRecipient };

/** Client mirror of the server `attempt()` result shape. */
export type Attempt<T> = { ok: true; data: T; source: string } | { ok: false; error: string; source: string };
export interface EpaTotals { institutions: number; tonsLow: number; tonsHigh: number }
export interface EpaDirectory { recipients: Attempt<EpaRecipient[]>; schools: Attempt<EpaGenerator[]>; totals: Attempt<EpaTotals> }

export const EPA_SOURCE = "EPA Excess Food Opportunities Map";

/** Datasets the app pulls from, for "Sources" footnotes. */
export const PUBLIC_SOURCES = [
  { name: "EPA Excess Food Opportunities Map", url: "https://www.epa.gov/sustainable-management-food/excess-food-opportunities-map", use: "Food banks, pantries and soup kitchens; school excess-food estimates" },
  { name: "USDA Food Access Research Atlas", url: "https://www.ers.usda.gov/data-products/food-access-research-atlas/", use: "Neighborhood (Census tract) food-access need for recipients" },
  { name: "U.S. Census Geocoder", url: "https://geocoding.geo.census.gov/", use: "Addresses to coordinates and Census tracts" },
  { name: "Open-Meteo", url: "https://open-meteo.com/", use: "Event-day weather that adjusts leftover forecasts" },
  { name: "Open Food Facts", url: "https://world.openfoodfacts.org/", use: "Barcode lookups for packaged food" },
  { name: "USDA FoodData Central", url: "https://fdc.nal.usda.gov/", use: "Nutrition and food-category data" },
  { name: "ProPublica Nonprofit Explorer (IRS)", url: "https://projects.propublica.org/nonprofits/", use: "Verifying recipient nonprofit status" },
] as const;

let inflight: Promise<EpaDirectory> | null = null;
let cached: EpaDirectory | null = null;

/** Fetch once per page session; both the impact page and the agent share the result. */
export function loadEpaDirectory(): Promise<EpaDirectory> {
  if (cached) return Promise.resolve(cached);
  inflight ??= fetch("/api/data/directory")
    .then(async (r) => {
      if (!r.ok) throw new Error(`Directory responded ${r.status}`);
      cached = (await r.json()) as EpaDirectory;
      return cached;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

export function useEpaDirectory() {
  const [data, setData] = useState<EpaDirectory | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    loadEpaDirectory().then((d) => alive && setData(d)).catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [nonce]);
  return { data, error, loading: !data && !error, retry: () => { cached = null; setData(null); setNonce((n) => n + 1); } };
}

const STOP = new Set(["the", "of", "in", "and", "a", "at", "for", "inc", "nashville", "middle", "tn", "tennessee", "metro", "hub", "food", "bank", "banks", "pantry", "kitchen", "soup", "community", "center", "ministry", "ministries", "outreach", "church", "foundation", "shelter", "&"]);
const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9& ]+/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t)));

/** Fuzzy name match: shares two distinctive words (or the only distinctive word of a short name). */
export function namesMatch(a: string, b: string) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return shared >= Math.min(2, ta.size, tb.size);
}

export const findOnNetwork = (name: string, recipients: RecipientOrg[]) => recipients.find((r) => namesMatch(name, r.name));

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "org";
export const placeholderEmail = (name: string) => `contact@${slug(name)}.example.org`;
export const fullAddress = (x: { address: string; city: string; zip: string }) => [x.address, x.city, x.zip].filter(Boolean).join(", ");
/**
 * EPA tons/year → meals per week (1.2 lb per meal). Uses EPA's *low* estimate: the high end
 * includes plate waste that can't be donated, which produced implausible numbers.
 */
export const mealsPerWeek = (tonsLow: number) => Math.round((tonsLow * 2000) / 1.2 / 52);
