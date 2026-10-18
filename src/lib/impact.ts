import { CATEGORIES, CATEGORY_LIST } from "./categories";
import type { Category, DemoState } from "./types";

export function computeImpact(state: DemoState, now: number) {
  const live = state.claims.filter((c) => c.status !== "CANCELLED");
  const byCategory = Object.fromEntries(CATEGORY_LIST.map((c) => [c, 0])) as Record<Category, number>;
  let lbs = 0;
  let co2eKg = 0;
  let deduction = 0;
  const claimMinutes: number[] = [];

  for (const claim of live) {
    const batch = state.batches.find((b) => b.id === claim.batchId);
    if (!batch) continue;
    const cfg = CATEGORIES[batch.category];
    byCategory[batch.category] += claim.qty;
    const w = claim.qty * cfg.lbsPerUnit;
    lbs += w;
    co2eKg += w * cfg.co2ePerLb;
    // Food: IRS 170(e)(3) enhanced deduction ≈ basis + half the markup, capped at 2× basis. Goods: fair-market value.
    deduction += batch.category === "food" ? claim.qty * cfg.valuePerUnit * 1.5 : claim.qty * cfg.valuePerUnit;
    claimMinutes.push((claim.claimedAt - batch.postedAt) / 60000);
  }

  const fellThrough = state.claims.filter((c) => c.status === "CLAIMED" && c.pickupBy < now).length;
  const pickedUp = state.claims.filter((c) => c.status === "PICKED_UP").length;
  const avgTimeToClaim = claimMinutes.length ? claimMinutes.reduce((a, b) => a + b, 0) / claimMinutes.length : 0;

  return {
    byCategory,
    totalItems: live.reduce((a, c) => a + c.qty, 0),
    lbs: Math.round(lbs),
    co2eKg: Math.round(co2eKg),
    deduction: Math.round(deduction),
    avgTimeToClaim: Math.round(avgTimeToClaim),
    fellThrough,
    pickedUp,
    openClaims: state.claims.filter((c) => c.status === "CLAIMED").length,
    activeBatches: state.batches.filter((b) => b.status === "AVAILABLE").length,
  };
}

export type ImpactStats = ReturnType<typeof computeImpact>;
