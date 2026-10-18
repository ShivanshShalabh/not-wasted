import "server-only";
import { fetchJson } from "./http";

/**
 * USDA ERS Food Access Research Atlas (2019 data, public ArcGIS mirror): per census tract,
 * whether it is low-income, low-access (a "food desert"), its poverty rate and median family income.
 */
const LAYER = "https://services2.arcgis.com/YFcshSieCVlb6AgV/arcgis/rest/services/FoodAccessResearchAtlasData2019/FeatureServer/0";

export interface TractAccess { tract: string; lowIncomeLowAccess: boolean; lowIncome: boolean; lowAccess1Mile: boolean; povertyRate: number; medianFamilyIncome: number | null; urban: boolean }

export function parseTract(a: Record<string, string | number | null>): TractAccess {
  return {
    tract: String(a.GEOID),
    lowIncomeLowAccess: Number(a.LILATracts) === 1,
    lowIncome: Number(a.LowIncomeT) === 1,
    lowAccess1Mile: Number(a.LATracts1) === 1,
    povertyRate: Math.round((Number(a.PovertyRat) || 0) * 10) / 10,
    medianFamilyIncome: Number(a.MedianFami) || null,
    urban: Number(a.Urban) === 1,
  };
}

/** 0..1 "area need" used to lift recipients in under-served tracts. */
export function areaNeed(t: TractAccess): number {
  return Math.min(1, (t.lowIncomeLowAccess ? 0.5 : 0) + (t.lowIncome ? 0.2 : 0) + Math.min(0.3, t.povertyRate / 100));
}

export async function tractAccess(geoid: string): Promise<TractAccess | null> {
  if (!/^\d{11}$/.test(geoid)) return null;
  const url = `${LAYER}/query?where=GEOID%3D%27${geoid}%27&outFields=GEOID,LILATracts,LowIncomeT,PovertyRat,MedianFami,LATracts1,Urban&returnGeometry=false&f=json`;
  const d = await fetchJson<{ features?: Array<{ attributes: Record<string, string | number | null> }> }>(url, { ttlMs: 7 * 24 * 3600_000 });
  const a = d.features?.[0]?.attributes;
  return a ? parseTract(a) : null;
}
