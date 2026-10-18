import { CATEGORIES } from "../categories";
import { matchRecipients, type Match } from "../matching";
import type { Batch, Claim, DemoState, RecipientOrg } from "../types";
import { step, type AgentStep } from "./trace";

/**
 * Pickup rescue agent: finds open claims about to miss their pickup window and decides
 * how to save the food — hand it to the next waitlisted org, or re-match it nearby.
 */
export interface RescueCase {
  claim: Claim;
  batch: Batch;
  recipient: RecipientOrg;
  minutesLeft: number;
  /** "waitlist": cancelling auto-claims for the queue; "rematch": offer to ranked orgs; "none": nobody can take it. */
  plan: "waitlist" | "rematch" | "none";
  waitlistNext?: { recipientId: string; name: string; qty: number };
  rematch: Array<Pick<Match, "score" | "reasons" | "fitsQty"> & { recipientId: string; name: string; contact: string; channel: string }>;
}

export const AT_RISK_MINUTES = 30;

/** Open claims whose window closes within the threshold, or has already closed. */
export function atRiskClaims(state: DemoState, now: number, thresholdMin = AT_RISK_MINUTES) {
  return state.claims
    .filter((c) => c.status === "CLAIMED" && c.pickupBy - now <= thresholdMin * 60_000)
    .sort((a, b) => a.pickupBy - b.pickupBy);
}

export function planRescue(state: DemoState, now: number, thresholdMin = AT_RISK_MINUTES): { cases: RescueCase[]; steps: AgentStep[] } {
  const risky = atRiskClaims(state, now, thresholdMin);
  const cases: RescueCase[] = [];
  for (const claim of risky) {
    const batch = state.batches.find((b) => b.id === claim.batchId);
    const recipient = state.recipients.find((r) => r.id === claim.recipientId);
    if (!batch || !recipient) continue;
    const queue = state.waitlist.filter((w) => w.batchId === batch.id && w.recipientId !== recipient.id).sort((a, b) => a.joinedAt - b.joinedAt);
    const next = queue[0] && state.recipients.find((r) => r.id === queue[0].recipientId);
    // Re-rank everyone except the org that is about to miss the pickup.
    const others = state.recipients.filter((r) => r.id !== recipient.id);
    const ranked = matchRecipients({ category: batch.category, title: batch.title, qty: claim.qty, attributes: batch.attributes }, others, 8).slice(0, 3);
    cases.push({
      claim, batch, recipient,
      minutesLeft: Math.round((claim.pickupBy - now) / 60_000),
      plan: next ? "waitlist" : ranked.length ? "rematch" : "none",
      waitlistNext: next ? { recipientId: next.id, name: next.name, qty: queue[0].qty } : undefined,
      rematch: ranked.map((m) => ({ recipientId: m.recipient.id, name: m.recipient.name, contact: m.recipient.contact, channel: m.recipient.notifyChannel, score: m.score, reasons: m.reasons, fitsQty: m.fitsQty })),
    });
  }

  const unit = (c: RescueCase) => CATEGORIES[c.batch.category].unit;
  const steps: AgentStep[] = [
    step("Scanning open pickups", [`${state.claims.filter((c) => c.status === "CLAIMED").length} open claims checked`, `Flagging any within ${thresholdMin} min of their window`]),
    step(cases.length ? `${cases.length} pickup${cases.length > 1 ? "s" : ""} at risk` : "No pickups at risk", cases.map((c) => `${c.recipient.name}: ${c.claim.qty} ${unit(c)} of ${c.batch.title} · ${c.minutesLeft < 0 ? `${-c.minutesLeft} min overdue` : `${c.minutesLeft} min left`}`)),
    ...(cases.length
      ? [step("Choosing a rescue plan", cases.map((c) => c.plan === "waitlist" ? `Waitlist: ${c.waitlistNext!.name} is next in line` : c.plan === "rematch" ? `Re-match: best nearby is ${c.rematch[0].name} (${c.rematch[0].score}%)` : "No org can take it — alert the donor"), "Semantic matching")]
      : []),
  ];
  return { cases, steps };
}

export function localRescueText(c: RescueCase, to: string) {
  const unit = CATEGORIES[c.batch.category].unit;
  return `URGENT from Not Wasted: ${c.claim.qty} ${unit} of ${c.batch.title} at ${c.batch.address} need pickup within ${Math.max(20, c.minutesLeft + 30)} min — the original pickup fell through. ${to}, reply YES to claim.`;
}
