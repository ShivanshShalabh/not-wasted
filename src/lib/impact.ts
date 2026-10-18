import { CATEGORIES, CATEGORY_LIST } from "./categories";
import type { Batch, Category, Claim, DemoState } from "./types";

/**
 * Assumed donor cost basis as a share of fair-market value (FMV). Demo figure: real donors
 * would enter their own invoice costs.
 */
export const COST_BASIS_SHARE = 0.6;

/**
 * Estimated deduction for donating `qty` units. Food uses the IRS §170(e)(3) enhanced
 * deduction: basis + half the appreciation (FMV − basis), capped at twice the basis and never
 * above FMV. Other goods use FMV. Estimates only — not tax advice.
 */
export function deductionFor(category: Category, qty: number) {
  const fmv = qty * CATEGORIES[category].valuePerUnit;
  const basis = fmv * COST_BASIS_SHARE;
  if (category !== "food") return { fmv, basis, deduction: fmv, method: "Fair-market value" as const };
  const deduction = Math.min(basis + (fmv - basis) / 2, 2 * basis, fmv);
  return { fmv, basis, deduction, method: "§170(e)(3) enhanced" as const };
}

/** Whose impact to count: one donor institution, one recipient org, or everyone. */
export type ImpactScope = { donor?: string; recipientId?: string };

const inScope = (scope: ImpactScope | undefined, claim: Claim, batch: Batch) =>
  (!scope?.donor || batch.institution === scope.donor) && (!scope?.recipientId || claim.recipientId === scope.recipientId);

export function computeImpact(state: DemoState, now: number, scope?: ImpactScope) {
  const pairs = state.claims.flatMap((c) => {
    const b = state.batches.find((x) => x.id === c.batchId);
    return b && inScope(scope, c, b) ? [{ claim: c, batch: b }] : [];
  });
  const live = pairs.filter((p) => p.claim.status !== "CANCELLED");
  const byCategory = Object.fromEntries(CATEGORY_LIST.map((c) => [c, 0])) as Record<Category, number>;
  let lbs = 0;
  let co2eKg = 0;
  let deduction = 0;
  const claimMinutes: number[] = [];

  for (const { claim, batch } of live) {
    const cfg = CATEGORIES[batch.category];
    byCategory[batch.category] += claim.qty;
    const w = claim.qty * cfg.lbsPerUnit;
    lbs += w;
    co2eKg += w * cfg.co2ePerLb;
    deduction += deductionFor(batch.category, claim.qty).deduction;
    claimMinutes.push((claim.claimedAt - batch.postedAt) / 60000);
  }

  const claims = pairs.map((p) => p.claim);
  const avgTimeToClaim = claimMinutes.length ? claimMinutes.reduce((a, b) => a + b, 0) / claimMinutes.length : 0;

  return {
    byCategory,
    totalItems: live.reduce((a, p) => a + p.claim.qty, 0),
    lbs: Math.round(lbs),
    co2eKg: Math.round(co2eKg),
    deduction: Math.round(deduction),
    avgTimeToClaim: Math.round(avgTimeToClaim),
    fellThrough: claims.filter((c) => c.status === "CLAIMED" && c.pickupBy < now).length,
    pickedUp: claims.filter((c) => c.status === "PICKED_UP").length,
    openClaims: claims.filter((c) => c.status === "CLAIMED").length,
    activeBatches: state.batches.filter((b) => b.status === "AVAILABLE" && (!scope?.donor || b.institution === scope.donor)).length,
  };
}

export type ImpactStats = ReturnType<typeof computeImpact>;

/** Per-donation rows behind a donor's deduction estimate (for the "how was this calculated" view). */
export function deductionLines(state: DemoState, donor: string) {
  return state.claims.flatMap((c) => {
    const b = state.batches.find((x) => x.id === c.batchId);
    if (!b || b.institution !== donor || c.status === "CANCELLED") return [];
    const r = state.recipients.find((x) => x.id === c.recipientId);
    return [{ claimId: c.id, title: b.title, category: b.category, recipient: r?.name ?? "Recipient", qty: c.qty, unit: CATEGORIES[b.category].unit, unitFmv: CATEGORIES[b.category].valuePerUnit, ...deductionFor(b.category, c.qty) }];
  });
}
