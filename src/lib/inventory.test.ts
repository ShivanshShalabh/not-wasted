import { describe, expect, it } from "vitest";
import { cancelClaim, claimBatch, updateQuantity } from "./inventory";
import { createSeedState } from "./seed";

const s = () => createSeedState(1_000_000);
const batch = (st: ReturnType<typeof s>, id: string) => st.batches.find((b) => b.id === id)!;
const cap = (st: ReturnType<typeof s>, id: string) => st.recipients.find((r) => r.id === id)!.capacity;

describe("split claiming", () => {
  it("claiming all remaining locks the batch", () => {
    const { state, error } = claimBatch(s(), "bat_grand_rounds", "rcp_st_lukes", 50, 1);
    expect(error).toBeUndefined();
    expect(batch(state, "bat_grand_rounds")).toMatchObject({ remainingQty: 0, status: "FULLY_CLAIMED" });
    expect(cap(state, "rcp_st_lukes").food).toBe(30);
  });

  it("partial claim keeps the batch open", () => {
    const { state } = claimBatch(s(), "bat_grand_rounds", "rcp_second_harvest", 20, 1);
    expect(batch(state, "bat_grand_rounds")).toMatchObject({ remainingQty: 30, status: "AVAILABLE" });
  });

  it("rejects over-remaining, over-capacity and unaccepted category", () => {
    expect(claimBatch(s(), "bat_grand_rounds", "rcp_second_harvest", 51, 1).error).toMatch(/Only 50 left/);
    expect(claimBatch(s(), "bat_hotel_linen", "rcp_st_lukes", 101, 1).error).toMatch(/capacity/);
    expect(claimBatch(s(), "bat_office_reno", "rcp_eastside", 1, 1).error).toMatch(/does not accept/);
  });

  it("furniture claim only touches furniture capacity; cancel restores", () => {
    const claimed = claimBatch(s(), "bat_office_reno", "rcp_st_lukes", 25, 1).state;
    expect(cap(claimed, "rcp_st_lukes")).toEqual({ food: 80, clothing: 100, furniture: 5 });
    const id = claimed.claims.at(-1)!.id;
    const undone = cancelClaim(claimed, id).state;
    expect(batch(undone, "bat_office_reno")).toMatchObject({ remainingQty: 25, status: "AVAILABLE" });
    expect(cap(undone, "rcp_st_lukes").furniture).toBe(30);
  });

  it("quantity update cannot drop below claimed", () => {
    expect(updateQuantity(s(), "bat_grand_rounds", 40).error).toMatch(/below 50/);
    expect(batch(updateQuantity(s(), "bat_grand_rounds", 120).state, "bat_grand_rounds").remainingQty).toBe(70);
  });
});

import { matchRecipients } from "./matching";

describe("matching", () => {
  it("ranks furniture needing a truck toward the furniture bank with a truck", () => {
    const m = matchRecipients({ category: "furniture", title: "Office chairs", qty: 20, attributes: { itemTypes: ["chairs"], needsTruck: true } }, s().recipients);
    expect(m[0].recipient.id).toBe("rcp_st_lukes");
    expect(m.every((x) => x.recipient.acceptedCategories.includes("furniture"))).toBe(true);
  });
});

import { joinWaitlist, reducer } from "./inventory";

describe("waitlist", () => {
  it("only fully claimed batches take a waitlist", () => {
    expect(joinWaitlist(s(), "bat_grand_rounds", "rcp_st_lukes", 10, 1).error).toMatch(/claim it directly/);
  });

  it("cancelled quantity goes to the first waitlisted recipient", () => {
    let st = claimBatch(s(), "bat_grand_rounds", "rcp_second_harvest", 50, 1).state; // now fully claimed
    st = reducer(st, { type: "JOIN_WAITLIST", batchId: "bat_grand_rounds", recipientId: "rcp_st_lukes", qty: 30, now: 2 });
    expect(st.waitlist).toHaveLength(1);
    const claimId = st.claims.at(-1)!.id;
    st = reducer(st, { type: "CANCEL_CLAIM", claimId, now: 3 });
    expect(st.claims.at(-1)).toMatchObject({ recipientId: "rcp_st_lukes", qty: 30, status: "CLAIMED" });
    expect(batch(st, "bat_grand_rounds").remainingQty).toBe(20);
    expect(st.waitlist).toHaveLength(0);
    expect(st.lastNotice).toMatch(/waitlist auto-claimed/);
  });

  it("partially served entries stay queued with the rest", () => {
    let st = claimBatch(s(), "bat_grand_rounds", "rcp_second_harvest", 50, 1).state;
    st = reducer(st, { type: "JOIN_WAITLIST", batchId: "bat_grand_rounds", recipientId: "rcp_st_lukes", qty: 70, now: 2 });
    st = reducer(st, { type: "CANCEL_CLAIM", claimId: st.claims.at(-1)!.id, now: 3 });
    expect(st.waitlist[0].qty).toBe(20);
    expect(batch(st, "bat_grand_rounds").status).toBe("FULLY_CLAIMED");
  });
});

import { checkDietary } from "./dietary";
import { semanticSimilarity } from "./semantic";

describe("dietary + semantic", () => {
  const pastry = { category: "food" as const, title: "Pastry boxes", attributes: { items: ["Croissants", "Almond muffins"], allergens: ["Gluten", "Tree nuts"], dietary: ["Vegetarian"] } };

  it("flags nut and diabetic conflicts for a nut-free, diabetic kitchen", () => {
    const c = checkDietary(pastry, "Nut-free please. Several diabetic guests.")!;
    expect(c.conflicts.join(" ")).toMatch(/Nut-free: contains tree nuts/);
    expect(c.conflicts.join(" ")).toMatch(/Diabetic-friendly/);
  });

  it("vegetarian food satisfies a no-pork / halal requirement", () => {
    expect(checkDietary(pastry, "Halal preferred, we cannot take pork")).toEqual({ ok: ["No pork"], conflicts: [] });
  });

  it("ignores non-food and empty requirements", () => {
    expect(checkDietary({ ...pastry, category: "clothing" }, "nut-free")).toBeNull();
    expect(checkDietary(pastry, "")).toBeNull();
  });

  it("related phrasing scores higher than unrelated", () => {
    expect(semanticSimilarity("turkey sandwich wraps", "boxed lunches for families")).toBeGreaterThan(semanticSimilarity("turkey sandwich wraps", "winter coats and boots"));
  });
});

import { meetsFilters } from "./dietary";

describe("dietary filters", () => {
  const pasta = { category: "food" as const, title: "Pasta primavera", attributes: { items: ["Pasta primavera"], allergens: ["Gluten", "Dairy"], dietary: ["Vegetarian"], storage: "Warm/Insulated" as const } };
  const chicken = { category: "food" as const, title: "Roasted chicken & rice", attributes: { items: ["Roasted chicken", "Rice pilaf"], allergens: [], dietary: [], storage: "Refrigerated" as const } };

  it("keeps food that meets every selected restriction", () => {
    expect(meetsFilters(pasta, ["Vegetarian", "Nut-free", "No refrigeration needed"])).toBe(true);
    expect(meetsFilters(pasta, ["Gluten-free"])).toBe(false);
    expect(meetsFilters(chicken, ["Vegetarian"])).toBe(false);
    expect(meetsFilters(chicken, ["No refrigeration needed"])).toBe(false);
  });

  it("never hides non-food or applies when nothing is selected", () => {
    expect(meetsFilters({ ...chicken, category: "clothing" }, ["Vegan"])).toBe(true);
    expect(meetsFilters(chicken, [])).toBe(true);
  });
});

describe("area need", () => {
  it("does not rank recipients by neighborhood poverty", () => {
    const base = s().recipients;
    const input = { category: "food" as const, title: "Sandwich platters", qty: 30, attributes: { items: ["sandwiches"] } };
    const before = matchRecipients(input, base).find((m) => m.recipient.id === "rcp_eastside")!;
    const st = reducer(s(), { type: "SET_AREA", areas: { rcp_eastside: { tract: "47037011900", need: 1, lowIncomeLowAccess: true, povertyRate: 41 } } });
    const after = matchRecipients(input, st.recipients).find((m) => m.recipient.id === "rcp_eastside")!;
    expect(after.score).toBe(before.score);
    expect(after.reasons.join(" ")).not.toMatch(/poverty|low-income/);
  });
});

import { setCapacity, updateClaim } from "./inventory";

describe("capacity and claim edits", () => {
  it("lets a recipient set capacity for categories it accepts only", () => {
    const st = setCapacity(s(), "rcp_st_lukes", { food: 120, other: 9 }).state;
    expect(cap(st, "rcp_st_lukes")).toEqual({ food: 120, clothing: 100, furniture: 30 });
    expect(setCapacity(s(), "rcp_st_lukes", { food: -1 }).error).toMatch(/0 or more/);
  });

  it("resizes an open claim within remaining and capacity, and frees units when shrinking", () => {
    const grown = updateClaim(s(), "clm_seed_1", 70).state; // Eastside had 50 of 100; 50 remain
    expect(batch(grown, "bat_grand_rounds")).toMatchObject({ remainingQty: 30, status: "AVAILABLE" });
    expect(updateClaim(s(), "clm_seed_1", 120).error).toMatch(/Only 50 more/);
    const shrunk = updateClaim(s(), "clm_seed_1", 20).state;
    expect(batch(shrunk, "bat_grand_rounds").remainingQty).toBe(80);
    expect(cap(shrunk, "rcp_eastside").food).toBe(55 + 30);
  });

  it("refuses the waitlist when everything is already picked up or you already hold a claim", () => {
    expect(joinWaitlist(s(), "bat_tech_summit", "rcp_st_lukes", 10, 1).error).toMatch(/picked up/);
    const full = claimBatch(s(), "bat_grand_rounds", "rcp_second_harvest", 50, 1).state;
    expect(joinWaitlist(full, "bat_grand_rounds", "rcp_eastside", 10, 1).error).toMatch(/edit it instead/);
  });
});

import { computeImpact, deductionFor } from "./impact";

describe("impact and deductions", () => {
  it("never deducts more than fair-market value for food", () => {
    const d = deductionFor("food", 100); // FMV $800, basis $480
    expect(d).toMatchObject({ fmv: 800, basis: 480, deduction: 640, method: "§170(e)(3) enhanced" });
    expect(deductionFor("furniture", 2).deduction).toBe(2 * 45);
  });

  it("scopes impact to one donor or one recipient", () => {
    const all = computeImpact(s(), 1_000_000);
    const eastside = computeImpact(s(), 1_000_000, { recipientId: "rcp_eastside" });
    expect(eastside.totalItems).toBe(80); // 50 pasta + 30 pastry
    const byDonor = (donor: string) => computeImpact(s(), 1_000_000, { donor }).totalItems;
    expect(byDonor("Vanderbilt University") + byDonor("Oracle")).toBe(all.totalItems);
    expect(byDonor("Oracle")).toBe(95); // 80 pastry boxes + 15 chairs
    expect(computeImpact(s(), 1_000_000, { donor: "Belmont University" }).totalItems).toBe(0);
  });
});

import { smallestClaim } from "./categories";

describe("minimum food quantity", () => {
  it("requires at least 5 for food claims, waitlists and donations, but lets the last few go", () => {
    expect(claimBatch(s(), "bat_grand_rounds", "rcp_st_lukes", 4, 1).error).toMatch(/at least 5/);
    expect(claimBatch(s(), "bat_grand_rounds", "rcp_st_lukes", 5, 1).error).toBeUndefined();
    expect(claimBatch(s(), "bat_hotel_linen", "rcp_st_lukes", 1, 1).error).toBeUndefined(); // clothing: no minimum
    expect(updateClaim(s(), "clm_seed_1", 3).error).toMatch(/at least 5/);
    expect(joinWaitlist(s(), "bat_tech_summit", "rcp_st_lukes", 2, 1).error).toMatch(/at least 5/);
    const st = reducer(s(), { type: "BROADCAST", batch: { ...s().batches[0], id: "bat_tiny", totalQty: 3, remainingQty: 3 } });
    expect(st.lastError).toMatch(/at least 5/);
    expect(smallestClaim({ category: "food", remainingQty: 3 })).toBe(3);
  });
});
