import type { Batch } from "./types";

/**
 * Checks a food donation's vision-detected allergens/dietary tags against a recipient's
 * free-text requirements ("we can't take pork", "nut-free please", "halal preferred").
 */

interface Rule {
  label: string;
  /** Phrases in the requirements text that turn the rule on. */
  when: RegExp;
  /** Allergen tags that break the rule. */
  allergens?: string[];
  /** Food words that break the rule. */
  foods?: RegExp;
  /** Dietary tags that satisfy the rule outright. */
  satisfiedBy?: string[];
}

const RULES: Rule[] = [
  { label: "Nut-free", when: /nut[- ]?free|no (pea)?nuts?|tree[- ]?nut|peanut/i, allergens: ["Peanuts", "Tree nuts"], foods: /\b(pea)?nuts?\b|almond|walnut|pecan|cashew|pistachio|hazelnut|praline/i },
  { label: "Gluten-free", when: /gluten|celiac|coeliac/i, allergens: ["Gluten"], foods: /bread|roll|pasta|wrap|pastry|croissant|muffin|cookie|cake|pizza|bagel|cracker/i, satisfiedBy: ["Gluten-free"] },
  { label: "Dairy-free", when: /dairy[- ]?free|lactose|no dairy/i, allergens: ["Dairy"], foods: /cheese|cream|milk|butter|yogurt/i, satisfiedBy: ["Vegan", "Dairy-free"] },
  { label: "Egg-free", when: /egg[- ]?free|no eggs?/i, allergens: ["Eggs"], satisfiedBy: ["Vegan"] },
  { label: "Shellfish-free", when: /shellfish/i, allergens: ["Shellfish"], foods: /shrimp|crab|lobster|prawn/i },
  { label: "No pork", when: /pork|halal|muslim|kosher/i, foods: /pork|bacon|ham\b|sausage|pepperoni|prosciutto/i, satisfiedBy: ["Halal", "Kosher", "Vegetarian", "Vegan"] },
  { label: "Vegetarian", when: /vegetarian|no meat/i, foods: /chicken|beef|pork|turkey|ham\b|bacon|sausage|fish|tuna|salmon|meatball/i, satisfiedBy: ["Vegetarian", "Vegan"] },
  { label: "Vegan", when: /\bvegan/i, allergens: ["Dairy", "Eggs"], foods: /chicken|beef|pork|turkey|ham\b|bacon|fish|cheese|egg|milk|butter|honey/i, satisfiedBy: ["Vegan"] },
  { label: "Diabetic-friendly", when: /diabet|low[- ]?sugar|sugar[- ]?free/i, foods: /cookie|cake|pastry|donut|doughnut|muffin|soda|candy|brownie|dessert/i },
  { label: "Hot or shelf-stable", when: /no (refrigeration|fridge)|hot or shelf/i, satisfiedBy: [] },
];

export interface DietaryCheck {
  /** Requirements this donation satisfies. */
  ok: string[];
  /** Requirements it breaks, with the reason. */
  conflicts: string[];
}

/** Returns null when the recipient states no food requirements or the batch is not food. */
export function checkDietary(batch: Pick<Batch, "category" | "title" | "attributes">, requirements: string | undefined): DietaryCheck | null {
  if (batch.category !== "food" || !requirements?.trim()) return null;
  const a = batch.attributes;
  const allergens = new Set((a.allergens ?? []).map((x) => x.toLowerCase()));
  const dietary = new Set((a.dietary ?? []).map((x) => x.replace(/\s*\(.*\)/, "").toLowerCase()));
  const foodText = [batch.title, ...(a.items ?? [])].join(" ");
  const active = RULES.filter((r) => r.when.test(requirements));
  if (!active.length) return null;

  const ok: string[] = [];
  const conflicts: string[] = [];
  for (const r of active) {
    if (r.label === "Hot or shelf-stable") {
      if (a.storage === "Refrigerated" || a.storage === "Frozen") conflicts.push(`Needs refrigeration (${a.storage.toLowerCase()})`);
      else if (a.storage) ok.push(a.storage === "Warm/Insulated" ? "Served hot" : "Shelf-stable");
      continue;
    }
    if (r.satisfiedBy?.some((t) => dietary.has(t.toLowerCase())) && !r.allergens?.some((x) => allergens.has(x.toLowerCase()))) {
      ok.push(r.label);
      continue;
    }
    const allergen = r.allergens?.find((x) => allergens.has(x.toLowerCase()));
    const food = r.foods ? foodText.match(r.foods)?.[0] : undefined;
    if (allergen) conflicts.push(`${r.label}: contains ${allergen.toLowerCase()}`);
    else if (food) conflicts.push(`${r.label}: has ${food.toLowerCase()}`);
    else ok.push(r.label);
  }
  return { ok, conflicts };
}

/** Restriction filters recipients can tick; each maps to requirement text the rules above understand. */
export const DIETARY_FILTERS = {
  Vegetarian: "vegetarian",
  Vegan: "vegan",
  "Halal / no pork": "halal, no pork",
  "Nut-free": "nut-free",
  "Gluten-free": "gluten-free",
  "Dairy-free": "dairy-free",
  "Egg-free": "egg-free",
  "Shellfish-free": "shellfish",
  "Diabetic-friendly": "diabetic",
  "No refrigeration needed": "no refrigeration",
} as const;
export type DietaryFilter = keyof typeof DIETARY_FILTERS;

/** True when a food batch breaks none of the selected restrictions. Non-food batches always pass. */
export function meetsFilters(batch: Pick<Batch, "category" | "title" | "attributes">, filters: DietaryFilter[]): boolean {
  if (!filters.length) return true;
  return !checkDietary(batch, filters.map((f) => DIETARY_FILTERS[f]).join(". "))?.conflicts.length;
}
