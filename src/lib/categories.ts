import type { Batch, Category } from "./types";

export interface CategoryConfig {
  label: string;
  unit: string;
  lbsPerUnit: number;
  /** kg CO2e avoided per lb diverted from landfill (EPA WARM-style estimates). */
  co2ePerLb: number;
  /** Estimated fair-market value per unit, USD, for deduction estimates. */
  valuePerUnit: number;
  pickupWindowHours: number;
  recipientNoun: string;
  color: string;
}

export const CATEGORIES: Record<Category, CategoryConfig> = {
  food: { label: "Food", unit: "meal packets", lbsPerUnit: 1.2, co2ePerLb: 1.9, valuePerUnit: 8, pickupWindowHours: 3, recipientNoun: "Food Banks", color: "emerald" },
  furniture: { label: "Furniture", unit: "pieces", lbsPerUnit: 35, co2ePerLb: 0.9, valuePerUnit: 45, pickupWindowHours: 72, recipientNoun: "Furniture Banks", color: "amber" },
  clothing: { label: "Clothing", unit: "items", lbsPerUnit: 0.8, co2ePerLb: 3.2, valuePerUnit: 6, pickupWindowHours: 72, recipientNoun: "Clothing Closets", color: "sky" },
  other: { label: "Other Items", unit: "items", lbsPerUnit: 3, co2ePerLb: 1.0, valuePerUnit: 10, pickupWindowHours: 72, recipientNoun: "Recipient Orgs", color: "violet" },
};

export const CATEGORY_LIST = Object.keys(CATEGORIES) as Category[];

export const unitOf = (c: Category) => CATEGORIES[c].unit;

/** Smallest food donation or pickup worth a trip. Other categories only need 1. */
export const MIN_FOOD_QTY = 5;
export const minQty = (c: Category) => (c === "food" ? MIN_FOOD_QTY : 1);
/** Smallest claim on a batch: the category minimum, or everything left when fewer remain. */
export const smallestClaim = (b: Pick<Batch, "category" | "remainingQty">) => Math.max(1, Math.min(minQty(b.category), b.remainingQty));
