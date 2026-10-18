import { CATEGORIES } from "../categories";
import { matchRecipients } from "../matching";
import type { Batch, DemoState } from "../types";
import { step, type AgentStep } from "./trace";

/** Capacity negotiator: splits a donation too big for any one recipient across the best-fitting orgs. */
export interface Allocation { recipientId: string; name: string; qty: number; score: number; reason: string; channel: string }

export function oversizedBatches(state: DemoState) {
  return state.batches.filter((b) => {
    if (b.status !== "AVAILABLE") return false;
    const caps = state.recipients.filter((r) => r.verified && r.acceptedCategories.includes(b.category)).map((r) => r.capacity[b.category] ?? 0);
    return b.remainingQty > Math.max(0, ...caps);
  });
}

export function proposeSplit(state: DemoState, batch: Batch, radiusMi = 10): { allocations: Allocation[]; unallocated: number; steps: AgentStep[] } {
  const ranked = matchRecipients({ category: batch.category, title: batch.title, qty: batch.remainingQty, attributes: batch.attributes }, state.recipients, radiusMi);
  let left = batch.remainingQty;
  const allocations: Allocation[] = [];
  for (const m of ranked) {
    if (left <= 0) break;
    const qty = Math.min(left, m.recipient.capacity[batch.category] ?? 0);
    if (qty < 1) continue;
    allocations.push({ recipientId: m.recipient.id, name: m.recipient.name, qty, score: m.score, reason: m.reasons.find((r) => !/^(Can take all|Room for|\d.* mi away)/.test(r)) ?? `${m.recipient.distanceMi} mi away`, channel: m.recipient.notifyChannel });
    left -= qty;
  }
  const unit = CATEGORIES[batch.category].unit;
  const steps: AgentStep[] = [
    step("Checking capacity", [`${batch.remainingQty} ${unit} to place`, `Largest single capacity: ${Math.max(0, ...ranked.map((m) => m.recipient.capacity[batch.category] ?? 0))} ${unit}`]),
    step("Ranking recipients", ranked.slice(0, 5).map((m) => `${m.recipient.name} — ${m.score}% · room for ${m.recipient.capacity[batch.category] ?? 0}`), "Semantic matching"),
    step("Proposing a split", allocations.map((a) => `${a.name}: ${a.qty} ${unit}`).concat(left > 0 ? [`${left} ${unit} still unplaced — widen the radius or ask the donor to hold`] : [])),
  ];
  return { allocations, unallocated: Math.max(0, left), steps };
}
