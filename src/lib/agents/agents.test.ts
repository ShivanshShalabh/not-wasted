import { describe, expect, it } from "vitest";
import { claimBatch, reducer } from "../inventory";
import { createSeedState } from "../seed";
import { missingFields, parseDeadline, parseLocation, parseQty, type IntakeDraft } from "./intake";
import { DEMO_HISTORY, learn, runForecaster } from "./forecaster";
import { localLetter, weeklyStats } from "./report";
import { planRescue } from "./rescue";
import { planRoute } from "./route";
import { oversizedBatches, proposeSplit } from "./split";

const NOW = 1_000_000_000_000;
const s = () => createSeedState(NOW);

describe("pickup rescue", () => {
  it("flags only claims near their window and prefers the waitlist", () => {
    let st = s();
    expect(planRescue(st, NOW).cases).toHaveLength(0);
    // Fill the batch, queue St. Luke's, then make Eastside's pickup nearly overdue.
    st = claimBatch(st, "bat_grand_rounds", "rcp_second_harvest", 50, NOW).state;
    st = reducer(st, { type: "JOIN_WAITLIST", batchId: "bat_grand_rounds", recipientId: "rcp_st_lukes", qty: 40, now: NOW });
    st = { ...st, claims: st.claims.map((c) => (c.id === "clm_seed_1" ? { ...c, pickupBy: NOW + 10 * 60_000 } : c)) };
    const { cases } = planRescue(st, NOW);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ plan: "waitlist", minutesLeft: 10, waitlistNext: { name: "St. Luke's Soup Kitchen", qty: 40 } });
    expect(cases[0].rematch.every((m) => m.recipientId !== "rcp_eastside")).toBe(true);
  });

  it("re-matches when nobody is waiting", () => {
    const st = { ...s(), claims: s().claims.map((c) => (c.id === "clm_seed_1" ? { ...c, pickupBy: NOW - 5 * 60_000 } : c)) };
    const [c] = planRescue(st, NOW).cases;
    expect(c.plan).toBe("rematch");
    expect(c.rematch.length).toBeGreaterThan(0);
  });
});

describe("route planner", () => {
  it("visits the tighter window first and warns about trucks", () => {
    const st = s();
    const org = { ...st.recipients.find((r) => r.id === "rcp_eastside")!, hasTruck: false };
    const b1 = st.batches[0], b2 = { ...st.batches[2] };
    const mk = (b: typeof b1, pickupBy: number, lat: number, lng: number) => ({ claim: { ...st.claims[0], batchId: b.id, pickupBy }, batch: b, lat, lng });
    const { route } = planRoute(org, { lat: 36.17, lng: -86.76 }, [mk(b2, NOW + 5 * 3600_000, 36.15, -86.8), mk(b1, NOW + 40 * 60_000, 36.14, -86.8)], NOW);
    expect(route[0].batch.id).toBe(b1.id);
    expect(route[1].warnings.join(" ")).toMatch(/truck/i);
  });
});

describe("donor intake parsing", () => {
  it("extracts quantity, deadline and place from a casual message", () => {
    const text = "~80 sandwiches left in Rand Hall, gone by 3pm";
    expect(parseQty(text)).toBe(80);
    expect(parseLocation(text)).toBe("Rand Hall");
    const d = new Date(parseDeadline(text, new Date(2026, 9, 17, 11, 0).getTime())!);
    expect([d.getHours(), d.getMinutes()]).toEqual([15, 0]);
    const draft: IntakeDraft = { category: "food", title: "Sandwiches", qty: 80, location: "Rand Hall", pickupBy: d.getTime(), attributes: {}, allergensConfirmed: false };
    expect(missingFields(draft)).toEqual(["storage", "allergens"]);
  });
});

describe("recurring-event forecaster", () => {
  it("learns no-show rates that beat the defaults on history", () => {
    const models = learn(DEMO_HISTORY);
    const career = models.find((m) => m.eventType === "Career Fair")!;
    expect(career.learnedNoShow).toBeGreaterThan(career.defaultNoShow);
    expect(career.errAfter).toBeLessThan(career.errBefore);
    const { recs } = runForecaster(s(), NOW);
    expect(recs[0]).toMatchObject({ eventId: "evt_career_fair" });
    expect(recs[0].recommendedOrder).toBeLessThan(recs[0].foodOrdered);
  });
});

describe("weekly report and capacity split", () => {
  it("summarizes a donor's week", () => {
    const { donors } = weeklyStats(s(), NOW);
    expect(donors[0]).toMatchObject({ institution: "Vanderbilt University" });
    expect(localLetter(donors[0], "Oct 12")).toMatch(/not tax advice/);
  });

  it("splits a donation bigger than any one recipient can take", () => {
    const big = { ...s().batches[0], id: "bat_big", remainingQty: 300, totalQty: 300, status: "AVAILABLE" as const };
    const st = { ...s(), batches: [big, ...s().batches] };
    expect(oversizedBatches(st).map((b) => b.id)).toContain("bat_big");
    const { allocations, unallocated } = proposeSplit(st, big);
    expect(allocations.length).toBeGreaterThan(1);
    expect(allocations.reduce((a, x) => a + x.qty, 0) + unallocated).toBe(300);
    for (const a of allocations) expect(a.qty).toBeLessThanOrEqual(st.recipients.find((r) => r.id === a.recipientId)!.capacity.food!);
  });
});
