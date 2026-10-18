import "server-only";
import { fetchJson, NASHVILLE_BBOX } from "./http";

/**
 * EPA Excess Food Opportunities Map (ArcGIS FeatureServer, public).
 * Layer 7: food banks, food pantries and soup kitchens. Layer 4: educational institutions
 * with EPA's estimated excess food (tons/year, low–high).
 */
const SERVICE = "https://services3.arcgis.com/g6eV2CrSSwCZj8Mc/arcgis/rest/services/EPA_ExcessFoodOpportunities/FeatureServer";

export interface EpaRecipient { id: string; name: string; type: string; address: string; city: string; zip: string; website?: string; lat: number; lng: number }
export interface EpaGenerator { id: string; name: string; kind: string; address: string; city: string; zip: string; phone?: string; website?: string; excessTonsLow: number; excessTonsHigh: number; lat: number; lng: number }

type Feature = { attributes: Record<string, string | number | null>; geometry?: { x: number; y: number } };

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s);
const site = (v: unknown) => (str(v) ? (str(v).startsWith("http") ? str(v) : `https://${str(v)}`) : undefined);

function query(layer: number, extra = "") {
  const [w, s, e, n] = NASHVILLE_BBOX;
  return `${SERVICE}/${layer}/query?where=1%3D1&geometry=${w},${s},${e},${n}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&outFields=*&f=json${extra}`;
}

export function parseRecipients(features: Feature[]): EpaRecipient[] {
  return features.map(({ attributes: a, geometry: g }) => ({
    id: str(a.UniqueID) || `epa_${a.OBJECTID}`,
    name: titleCase(str(a.Name)),
    type: str(a.Type) || "Food pantry",
    address: titleCase(str(a.Address)),
    city: titleCase(str(a.City)),
    zip: str(a.Zip_Code),
    website: site(a.Website),
    lat: g?.y ?? Number(a.Latitude),
    lng: g?.x ?? Number(a.Longitude),
  }));
}

export function parseGenerators(features: Feature[]): EpaGenerator[] {
  return features.map(({ attributes: a, geometry: g }) => ({
    id: str(a.UniqueID) || `epa_${a.OBJECTID}`,
    name: titleCase(str(a.Name)),
    kind: str(a.School_Type) || "Educational institution",
    address: titleCase(str(a.Address)),
    city: titleCase(str(a.City)),
    zip: str(a.Zip_Code),
    phone: str(a.Phone) || undefined,
    website: site(a.Website),
    excessTonsLow: Number(a.ExcessFood_TonYear_LowEst) || 0,
    excessTonsHigh: Number(a.ExcessFood_TonYear_HighEst) || 0,
    lat: g?.y ?? Number(a.Latitude),
    lng: g?.x ?? Number(a.Longitude),
  }));
}

export async function epaFoodRecipients() {
  const d = await fetchJson<{ features?: Feature[] }>(query(7), { ttlMs: 24 * 3600_000 });
  return parseRecipients(d.features ?? []);
}

/** Schools/universities ranked by EPA's high estimate of excess food. */
export async function epaSchoolGenerators(limit = 25) {
  const d = await fetchJson<{ features?: Feature[] }>(query(4, `&orderByFields=ExcessFood_TonYear_HighEst+DESC&resultRecordCount=${limit}`), { ttlMs: 24 * 3600_000 });
  return parseGenerators(d.features ?? []);
}

/** County-wide totals across all EPA-listed educational institutions. */
export async function epaSchoolTotals() {
  const [w, s, e, n] = NASHVILLE_BBOX;
  const stats = encodeURIComponent(JSON.stringify([
    { statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "n" },
    { statisticType: "sum", onStatisticField: "ExcessFood_TonYear_LowEst", outStatisticFieldName: "low" },
    { statisticType: "sum", onStatisticField: "ExcessFood_TonYear_HighEst", outStatisticFieldName: "high" },
  ]));
  const url = `${SERVICE}/4/query?where=1%3D1&geometry=${w},${s},${e},${n}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outStatistics=${stats}&f=json`;
  const d = await fetchJson<{ features?: Feature[] }>(url, { ttlMs: 24 * 3600_000 });
  const a = d.features?.[0]?.attributes ?? {};
  return { institutions: Number(a.n) || 0, tonsLow: Math.round(Number(a.low) || 0), tonsHigh: Math.round(Number(a.high) || 0) };
}
