import "server-only";
import { fetchJson } from "./http";

/**
 * USDA FoodData Central search (public domain). Uses FDC_API_KEY when set, else the shared
 * DEMO_KEY (rate-limited). Ingredient statements are scanned for the major US allergens.
 */
export interface FdcMatch { fdcId: number; description: string; category?: string; brand?: string; ingredients?: string; allergens: string[] }

const ALLERGEN_WORDS: Array<[string, RegExp]> = [
  ["Gluten", /\b(wheat|semolina|barley|rye|spelt|malt)\b/i],
  ["Dairy", /\b(milk|cheese|butter|cream|whey|casein|yogurt)\b/i],
  ["Eggs", /\begg/i],
  ["Peanuts", /\bpeanut/i],
  ["Tree nuts", /\b(almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia)/i],
  ["Soy", /\bsoy/i],
  ["Fish", /\b(salmon|tuna|cod|anchov|fish)\b/i],
  ["Shellfish", /\b(shrimp|crab|lobster|prawn|clam|oyster)\b/i],
  ["Sesame", /\bsesame/i],
];

export const allergensIn = (ingredients = "") => ALLERGEN_WORDS.filter(([, re]) => re.test(ingredients)).map(([name]) => name);

interface FdcResponse { foods?: Array<{ fdcId: number; description: string; foodCategory?: string; brandOwner?: string; ingredients?: string }> }

export function parseFoods(d: FdcResponse): FdcMatch[] {
  return (d.foods ?? []).map((f) => ({
    fdcId: f.fdcId,
    description: f.description.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    category: f.foodCategory,
    brand: f.brandOwner,
    ingredients: f.ingredients,
    allergens: allergensIn(f.ingredients),
  }));
}

export async function searchFoods(query: string, pageSize = 3) {
  const key = process.env.FDC_API_KEY || "DEMO_KEY";
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&api_key=${key}`;
  return parseFoods(await fetchJson<FdcResponse>(url, { ttlMs: 24 * 3600_000 }));
}
