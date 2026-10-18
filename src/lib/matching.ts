import { CATEGORIES } from "./categories";
import { checkDietary } from "./dietary";
import { semanticSimilarity } from "./semantic";
import type { Category, ItemAttributes, RecipientOrg } from "./types";

export interface MatchInput {
  category: Category;
  title: string;
  qty: number;
  attributes: ItemAttributes;
}

export interface Match {
  recipient: RecipientOrg;
  score: number;
  reasons: string[];
  fitsQty: number;
  /** 0..1 semantic fit between the donation and the recipient's needs + requirements. */
  semantic: number;
}

/** Text a recipient is matched on: their need keywords plus free-text requirements. */
export const recipientProfile = (r: RecipientOrg) => [r.type, ...r.needs, r.requirements ?? ""].join(". ");

export const donationText = (input: Pick<MatchInput, "title" | "attributes">) => {
  const a = input.attributes;
  return [input.title, ...(a.items ?? []), ...(a.itemTypes ?? []), ...(a.garmentTypes ?? []), ...(a.dietary ?? []), a.season ?? "", a.notes ?? ""].join(" ");
};

const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);

/**
 * Ranks nearby verified recipients for a donation (local twin of the 26ai
 * VECTOR_DISTANCE + SDO_WITHIN_DISTANCE query in db/schema_oracle26ai.sql).
 * Weights: capacity fit 35 · distance 25 · need fit 25 · handling 15.
 * Need fit is the better of keyword hits and semantic similarity; pass `semantic`
 * (recipientId → 0..1, e.g. from OCI embeddings) to override the local similarity.
 * Food that breaks a recipient's stated dietary requirements loses its handling score.
 * Recipients in under-served tracts (USDA Food Access Research Atlas) get up to +8 as a tie-breaker.
 */
export function matchRecipients(input: MatchInput, recipients: RecipientOrg[], radiusMi = 5, semantic?: Record<string, number>): Match[] {
  const a = input.attributes;
  const unit = CATEGORIES[input.category].unit;
  const itemText = donationText(input);
  const itemWords = new Set(words(itemText));

  return recipients
    .filter((r) => r.verified && r.acceptedCategories.includes(input.category) && r.distanceMi <= radiusMi && (r.capacity[input.category] ?? 0) > 0)
    .map((r) => {
      const cap = r.capacity[input.category] ?? 0;
      const fitsQty = Math.min(cap, input.qty);
      const reasons: string[] = [];

      const capScore = 35 * (input.qty ? fitsQty / input.qty : 1);
      reasons.push(fitsQty >= input.qty ? `Can take all ${input.qty} ${unit}` : `Room for ${fitsQty} of ${input.qty}`);

      const distScore = 25 * (1 - r.distanceMi / radiusMi);
      reasons.push(`${r.distanceMi} mi away`);

      const hits = r.needs.filter((n) => words(n).some((w) => itemWords.has(w) || itemWords.has(w.replace(/s$/, ""))));
      const sim = semantic?.[r.id] ?? semanticSimilarity(itemText, recipientProfile(r));
      const needScore = Math.max(Math.min(25, hits.length * 12.5), Math.min(25, sim * 50));
      if (hits.length) reasons.push(`Needs ${hits.slice(0, 2).join(", ")}`);
      else if (sim >= 0.2) reasons.push(`Semantic fit ${Math.round(sim * 100)}%`);

      let handling = 10;
      if (input.category === "food" && (a.storage === "Refrigerated" || a.storage === "Frozen")) {
        handling = r.coldStorage ? 15 : 0;
        reasons.push(r.coldStorage ? "Has cold storage" : "No refrigeration");
      }
      if (a.needsTruck) {
        handling = r.hasTruck ? 15 : 0;
        reasons.push(r.hasTruck ? "Has a truck" : "Needs donor delivery");
      }

      const diet = checkDietary(input, r.requirements);
      if (diet?.conflicts.length) {
        handling = 0;
        reasons.push(diet.conflicts[0]);
      } else if (diet?.ok.length) reasons.push(`Meets ${diet.ok.slice(0, 2).join(", ").toLowerCase()}`);

      return { recipient: r, score: Math.min(100, Math.round(capScore + distScore + needScore + handling)), reasons, fitsQty, semantic: sim };
    })
    .sort((x, y) => y.score - x.score);
}
