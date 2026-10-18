import "server-only";
import { fetchJson } from "./http";

/** Open Food Facts (open database, ODbL): barcode → product name, allergens and diet labels. */
export interface PackagedProduct { barcode: string; name: string; brand?: string; allergens: string[]; dietary: string[]; imageUrl?: string }

const ALLERGENS: Record<string, string> = {
  "en:gluten": "Gluten", "en:milk": "Dairy", "en:eggs": "Eggs", "en:peanuts": "Peanuts", "en:nuts": "Tree nuts",
  "en:soybeans": "Soy", "en:fish": "Fish", "en:crustaceans": "Shellfish", "en:molluscs": "Shellfish", "en:sesame-seeds": "Sesame",
};
const LABELS: Record<string, string> = {
  "en:vegan": "Vegan", "en:vegetarian": "Vegetarian", "en:halal": "Halal", "en:kosher": "Kosher", "en:no-gluten": "Gluten-free",
  "en:gluten-free": "Gluten-free", "en:no-lactose": "Dairy-free", "en:organic": "Organic",
};

interface OffResponse { status: number; product?: { product_name?: string; brands?: string; allergens_tags?: string[]; labels_tags?: string[]; ingredients_analysis_tags?: string[]; image_front_small_url?: string } }

export function parseProduct(barcode: string, d: OffResponse): PackagedProduct | null {
  const p = d.product;
  if (d.status !== 1 || !p) return null;
  const allergens = [...new Set((p.allergens_tags ?? []).map((t) => ALLERGENS[t]).filter(Boolean))];
  const dietary = new Set((p.labels_tags ?? []).map((t) => LABELS[t]).filter(Boolean));
  // Ingredient analysis says "en:vegan" only when confident (unknown/non-vegan use other tags).
  for (const t of p.ingredients_analysis_tags ?? []) {
    if (t === "en:vegan") dietary.add("Vegan");
    if (t === "en:vegetarian") dietary.add("Vegetarian");
  }
  return { barcode, name: p.product_name?.trim() || "Packaged food", brand: p.brands?.split(",")[0]?.trim() || undefined, allergens, dietary: [...dietary], imageUrl: p.image_front_small_url };
}

export async function productByBarcode(barcode: string) {
  if (!/^\d{8,14}$/.test(barcode)) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,allergens_tags,labels_tags,ingredients_analysis_tags,image_front_small_url`;
  return parseProduct(barcode, await fetchJson<OffResponse>(url, { ttlMs: 24 * 3600_000 }));
}
