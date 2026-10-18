import { CATEGORIES, minQty } from "../categories";
import type { Category, ItemAttributes, StorageType } from "../types";

/**
 * Donor intake agent: turns a donor's free-text message ("~80 sandwiches left in Rand, gone by 3pm")
 * into a draft donation, then lists what is still missing so the agent can ask for it.
 */
export interface IntakeDraft {
  category: Category;
  title: string;
  qty: number | null;
  location: string;
  /** Epoch ms the food must be picked up by. */
  pickupBy: number | null;
  attributes: ItemAttributes;
  /** Donor explicitly confirmed allergens (or "none"). */
  allergensConfirmed: boolean;
}

export type MissingField = "qty" | "pickupBy" | "storage" | "allergens" | "location";

/** "~80", "about 80", "80 boxes" → 80. */
export function parseQty(text: string): number | null {
  const m = text.match(/(?:~|about|around|approx\.?|roughly)?\s*(\d{1,4})\s*(?:[a-z]|$)/i);
  return m ? Number(m[1]) : null;
}

/** "by 3pm", "until 14:30", "gone by 3" → today's timestamp at that time (next day if already past). */
export function parseDeadline(text: string, now: number): number | null {
  const m = text.match(/\b(?:by|until|till|before|gone by|leave at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h < 8) h += 12; // "by 3" during a working day means 3pm
  const d = new Date(now);
  d.setHours(h, min, 0, 0);
  if (d.getTime() < now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** "in Rand", "at the 3rd floor lounge" → location phrase. */
export function parseLocation(text: string): string {
  const m = text.match(/\b(?:in|at|from)\s+(?:the\s+)?([A-Z0-9][\w'’&.-]*(?:\s+[A-Z0-9][\w'’&.-]*){0,4})/);
  return m ? m[1].trim() : "";
}

export function missingFields(d: IntakeDraft): MissingField[] {
  const out: MissingField[] = [];
  // Too few to be worth a pickup counts as missing, so the agent asks again.
  if (!d.qty || d.qty < minQty(d.category)) out.push("qty");
  if (!d.pickupBy) out.push("pickupBy");
  if (!d.location) out.push("location");
  if (d.category === "food" && !d.attributes.storage) out.push("storage");
  if (d.category === "food" && !d.allergensConfirmed) out.push("allergens");
  return out;
}

export const QUESTIONS: Record<MissingField, string> = {
  qty: "Roughly how many portions or items are there?",
  pickupBy: "When does it need to be picked up by?",
  location: "Where should the food bank collect it — building and room?",
  storage: "How is it being kept right now?",
  allergens: "I spotted these possible allergens from the description. Are they right?",
};

export const STORAGE_CHOICES: StorageType[] = ["Refrigerated", "Frozen", "Warm/Insulated", "Shelf-Stable"];

export function defaultPickupBy(category: Category, now: number) {
  return now + CATEGORIES[category].pickupWindowHours * 3600_000;
}
