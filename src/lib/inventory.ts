import { CATEGORIES } from "./categories";
import type { Account, AreaNeed, Batch, Category, Claim, ImpactReport, DemoState, DonorEvent, RecipientOrg, View, WaitlistEntry } from "./types";

export type Action =
  | { type: "HYDRATE"; state: DemoState }
  | { type: "RESET"; state: DemoState }
  | { type: "SET_VIEW"; view: View }
  | { type: "SET_RECIPIENT"; recipientId: string }
  | { type: "CREATE_EVENT"; event: DonorEvent }
  | { type: "TRIGGER_PING"; eventId?: string }
  | { type: "CLOSE_PING" }
  | { type: "BROADCAST"; batch: Batch }
  | { type: "CLAIM"; batchId: string; recipientId: string; qty: number; now: number }
  | { type: "CANCEL_CLAIM"; claimId: string; now?: number }
  | { type: "JOIN_WAITLIST"; batchId: string; recipientId: string; qty: number; now: number }
  | { type: "LEAVE_WAITLIST"; entryId: string }
  | { type: "SET_REQUIREMENTS"; recipientId: string; requirements: string }
  | { type: "SET_AREA"; areas: Record<string, AreaNeed> }
  /** Recipient edits how much it can take right now, per accepted category. */
  | { type: "SAVE_REPORT"; report: ImpactReport }
  | { type: "SET_CAPACITY"; recipientId: string; capacity: Partial<Record<Category, number>> }
  /** Recipient changes the quantity of its own open claim (0 cancels it). */
  | { type: "UPDATE_CLAIM"; claimId: string; qty: number; now: number }
  /** Demo: pull an open claim's pickup window in so the rescue agent has something to rescue. */
  | { type: "DEMO_LATE_PICKUP"; now: number; minutesLeft: number }
  /** Forecaster agent: adopt a recommended catering order for an upcoming event. */
  | { type: "UPDATE_EVENT_ORDER"; eventId: string; foodOrdered: number; predictedSurplus: number }
  | { type: "CONFIRM_HANDOFF"; claimId: string; now: number }
  | { type: "UPDATE_QTY"; batchId: string; totalQty: number }
  | { type: "REGISTER_RECIPIENT"; recipient: RecipientOrg }
  | { type: "REGISTER_ACCOUNT"; account: Account; recipient?: RecipientOrg }
  | { type: "LOGIN"; accountId: string }
  | { type: "LOGOUT" }
  | { type: "CLEAR_ERROR" }
  | { type: "CLEAR_NOTICE" };

type Result = { state: DemoState; error?: string };

export const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/** Highest quantity a recipient may claim from a batch right now. 0 means it cannot claim. */
export function maxClaimable(batch: Batch, recipient: RecipientOrg): number {
  if (batch.status !== "AVAILABLE") return 0;
  if (!recipient.acceptedCategories.includes(batch.category)) return 0;
  return Math.max(0, Math.min(batch.remainingQty, recipient.capacity[batch.category] ?? 0));
}

/**
 * Atomic decrement, mirroring the SQL guard:
 * UPDATE surplus_batches SET remaining_qty = remaining_qty - :q WHERE batch_id = :id AND remaining_qty >= :q
 */
export function claimBatch(state: DemoState, batchId: string, recipientId: string, qty: number, now: number): Result {
  const batch = state.batches.find((b) => b.id === batchId);
  const recipient = state.recipients.find((r) => r.id === recipientId);
  if (!batch || !recipient) return { state, error: "Batch or recipient not found." };
  if (batch.status !== "AVAILABLE") return { state, error: "This batch is fully claimed." };
  if (!recipient.acceptedCategories.includes(batch.category))
    return { state, error: `${recipient.name} does not accept ${CATEGORIES[batch.category].label.toLowerCase()}.` };
  if (!Number.isInteger(qty) || qty < 1) return { state, error: "Claim at least 1." };
  if (qty > batch.remainingQty) return { state, error: `Only ${batch.remainingQty} left — someone claimed first.` };
  const cap = recipient.capacity[batch.category] ?? 0;
  if (qty > cap) return { state, error: `Exceeds your available capacity (${cap}).` };

  const remainingQty = batch.remainingQty - qty;
  const claim: Claim = {
    id: newId("clm"),
    batchId,
    recipientId,
    qty,
    claimedAt: now,
    etaMinutes: Math.round(recipient.distanceMi * 4 + 10),
    pickupBy: batch.pickupBy,
    status: "CLAIMED",
  };
  return {
    state: {
      ...state,
      batches: state.batches.map((b) =>
        b.id === batchId ? { ...b, remainingQty, status: remainingQty === 0 ? "FULLY_CLAIMED" : "AVAILABLE" } : b,
      ),
      recipients: state.recipients.map((r) =>
        r.id === recipientId ? { ...r, capacity: { ...r.capacity, [batch.category]: cap - qty } } : r,
      ),
      claims: [...state.claims, claim],
    },
  };
}

export function cancelClaim(state: DemoState, claimId: string): Result {
  const claim = state.claims.find((c) => c.id === claimId);
  if (!claim || claim.status !== "CLAIMED") return { state, error: "Only open claims can be cancelled." };
  const batch = state.batches.find((b) => b.id === claim.batchId)!;
  return {
    state: {
      ...state,
      claims: state.claims.map((c) => (c.id === claimId ? { ...c, status: "CANCELLED" } : c)),
      batches: state.batches.map((b) =>
        b.id === batch.id ? { ...b, remainingQty: b.remainingQty + claim.qty, status: "AVAILABLE" } : b,
      ),
      recipients: state.recipients.map((r) =>
        r.id === claim.recipientId
          ? { ...r, capacity: { ...r.capacity, [batch.category]: (r.capacity[batch.category] ?? 0) + claim.qty } }
          : r,
      ),
    },
  };
}

/** Queue for a fully claimed batch. One entry per recipient per batch. */
export function joinWaitlist(state: DemoState, batchId: string, recipientId: string, qty: number, now: number): Result {
  const batch = state.batches.find((b) => b.id === batchId);
  const recipient = state.recipients.find((r) => r.id === recipientId);
  if (!batch || !recipient) return { state, error: "Batch or recipient not found." };
  if (batch.status === "AVAILABLE") return { state, error: "Still available — claim it directly." };
  if (!recipient.acceptedCategories.includes(batch.category))
    return { state, error: `${recipient.name} does not accept ${CATEGORIES[batch.category].label.toLowerCase()}.` };
  if (!Number.isInteger(qty) || qty < 1) return { state, error: "Request at least 1." };
  if (state.waitlist.some((w) => w.batchId === batchId && w.recipientId === recipientId)) return { state, error: "You're already on this waitlist." };
  if (state.claims.some((c) => c.batchId === batchId && c.recipientId === recipientId && c.status === "CLAIMED"))
    return { state, error: "You already have a claim on this batch — edit it instead." };
  // A waitlist only helps while someone else's pickup could still fall through.
  if (!state.claims.some((c) => c.batchId === batchId && c.status === "CLAIMED"))
    return { state, error: "Everything here has already been picked up." };
  const entry: WaitlistEntry = { id: newId("wl"), batchId, recipientId, qty, joinedAt: now };
  return { state: { ...state, waitlist: [...state.waitlist, entry] } };
}

/**
 * Hands freed quantity to the waitlist in join order. Each entry is claimed up to its
 * request and the recipient's capacity; fully served entries leave the list.
 */
export function promoteWaitlist(state: DemoState, batchId: string, now: number): { state: DemoState; promoted: string[] } {
  let next = state;
  const promoted: string[] = [];
  const queue = state.waitlist.filter((w) => w.batchId === batchId).sort((a, b) => a.joinedAt - b.joinedAt);
  for (const w of queue) {
    const batch = next.batches.find((b) => b.id === batchId)!;
    const recipient = next.recipients.find((r) => r.id === w.recipientId);
    if (batch.remainingQty === 0) break;
    if (!recipient) continue;
    const take = Math.min(w.qty, batch.remainingQty, recipient.capacity[batch.category] ?? 0);
    if (take < 1) continue;
    const res = claimBatch(next, batchId, w.recipientId, take, now);
    if (res.error) continue;
    next = {
      ...res.state,
      waitlist: take === w.qty ? res.state.waitlist.filter((x) => x.id !== w.id) : res.state.waitlist.map((x) => (x.id === w.id ? { ...x, qty: x.qty - take } : x)),
    };
    promoted.push(`${recipient.name} (${take})`);
  }
  return { state: next, promoted };
}

/** Recipient resizes its open claim within what is left and its capacity; shrinking frees units for the waitlist. */
export function updateClaim(state: DemoState, claimId: string, qty: number): Result {
  const claim = state.claims.find((c) => c.id === claimId);
  if (!claim || claim.status !== "CLAIMED") return { state, error: "Only open claims can be changed." };
  if (!Number.isInteger(qty) || qty < 0) return { state, error: "Enter a whole number." };
  if (qty === 0) return cancelClaim(state, claimId);
  const batch = state.batches.find((b) => b.id === claim.batchId)!;
  const recipient = state.recipients.find((r) => r.id === claim.recipientId)!;
  const delta = qty - claim.qty;
  const cap = recipient.capacity[batch.category] ?? 0;
  if (delta > batch.remainingQty) return { state, error: `Only ${batch.remainingQty} more available.` };
  if (delta > cap) return { state, error: `Exceeds your available capacity (${cap}).` };
  const remainingQty = batch.remainingQty - delta;
  return {
    state: {
      ...state,
      claims: state.claims.map((c) => (c.id === claimId ? { ...c, qty } : c)),
      batches: state.batches.map((b) => (b.id === batch.id ? { ...b, remainingQty, status: remainingQty === 0 ? "FULLY_CLAIMED" : "AVAILABLE" } : b)),
      recipients: state.recipients.map((r) => (r.id === recipient.id ? { ...r, capacity: { ...r.capacity, [batch.category]: cap - delta } } : r)),
    },
  };
}

export function setCapacity(state: DemoState, recipientId: string, capacity: Partial<Record<Category, number>>): Result {
  const r = state.recipients.find((x) => x.id === recipientId);
  if (!r) return { state, error: "Recipient not found." };
  const next = { ...r.capacity };
  for (const [c, v] of Object.entries(capacity) as [Category, number][]) {
    if (!r.acceptedCategories.includes(c)) continue;
    if (!Number.isInteger(v) || v < 0 || v > 100_000) return { state, error: "Capacity must be a whole number of 0 or more." };
    next[c] = v;
  }
  return { state: { ...state, recipients: state.recipients.map((x) => (x.id === recipientId ? { ...x, capacity: next } : x)) } };
}

/** Donor corrects the confirmed count. Cannot go below what recipients already claimed. */
export function updateQuantity(state: DemoState, batchId: string, totalQty: number): Result {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) return { state, error: "Batch not found." };
  const claimed = batch.totalQty - batch.remainingQty;
  if (!Number.isInteger(totalQty) || totalQty < claimed)
    return { state, error: `Cannot go below ${claimed} already claimed.` };
  const remainingQty = totalQty - claimed;
  return {
    state: {
      ...state,
      batches: state.batches.map((b) =>
        b.id === batchId ? { ...b, totalQty, remainingQty, status: remainingQty === 0 ? "FULLY_CLAIMED" : "AVAILABLE" } : b,
      ),
    },
  };
}

function apply(state: DemoState, result: Result, notice: string): DemoState {
  return result.error ? { ...state, lastError: result.error, lastNotice: null } : { ...result.state, lastError: null, lastNotice: notice };
}

/** Applies a quantity-freeing change, then offers the freed units to the batch's waitlist. */
function applyAndPromote(state: DemoState, result: Result, batchId: string | undefined, now: number, notice: string): DemoState {
  if (result.error || !batchId) return apply(state, result, notice);
  const { state: next, promoted } = promoteWaitlist(result.state, batchId, now);
  return apply(state, { state: next }, promoted.length ? `${notice} · waitlist auto-claimed: ${promoted.join(", ")}` : notice);
}

const unitFor = (state: DemoState, batchId: string) => {
  const b = state.batches.find((x) => x.id === batchId);
  return b ? CATEGORIES[b.category].unit : "items";
};

export function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;
    case "RESET": {
      // Reseed the demo but keep the signed-in user if their account still exists.
      const keep = action.state.accounts.find((a) => a.id === state.sessionId);
      return keep ? reducer(action.state, { type: "LOGIN", accountId: keep.id }) : action.state;
    }
    case "REGISTER_ACCOUNT": {
      const next = {
        ...state,
        accounts: [...state.accounts, action.account],
        recipients: action.recipient ? [...state.recipients, action.recipient] : state.recipients,
      };
      return { ...reducer(next, { type: "LOGIN", accountId: action.account.id }), lastNotice: `Welcome to Not Wasted, ${action.account.orgName}` };
    }
    case "LOGIN": {
      const acc = state.accounts.find((a) => a.id === action.accountId);
      if (!acc) return { ...state, lastError: "Account not found." };
      return {
        ...state,
        sessionId: acc.id,
        view: acc.role,
        activeRecipientId: acc.recipientId ?? state.activeRecipientId,
        pingEventId: null,
      };
    }
    case "LOGOUT":
      return { ...state, sessionId: null, pingEventId: null };
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "SET_RECIPIENT":
      return { ...state, activeRecipientId: action.recipientId };
    case "CREATE_EVENT":
      return { ...state, events: [action.event, ...state.events], lastNotice: `"${action.event.name}" registered · forecast sent` };
    case "TRIGGER_PING": {
      const me = state.accounts.find((a) => a.id === state.sessionId);
      const own = state.events.filter((e) => !me || me.role !== "donor" || e.institution === me.orgName);
      const target = state.events.find((e) => e.id === action.eventId) ?? own.find((e) => !e.batchId);
      if (!target) return { ...state, lastError: "No upcoming event awaiting a T-45 ping." };
      return { ...state, view: "donor", pingEventId: target.id };
    }
    case "CLOSE_PING":
      return { ...state, pingEventId: null };
    case "BROADCAST":
      return {
        ...state,
        pingEventId: null,
        lastNotice: `Broadcast ${action.batch.totalQty} ${CATEGORIES[action.batch.category].unit} to nearby recipients`,
        batches: [action.batch, ...state.batches],
        events: state.events.map((e) =>
          e.id === action.batch.eventId ? { ...e, pingSent: true, batchId: action.batch.id } : e,
        ),
      };
    case "CLAIM":
      return apply(state, claimBatch(state, action.batchId, action.recipientId, action.qty, action.now), `Claimed ${action.qty} ${unitFor(state, action.batchId)}`);
    case "CANCEL_CLAIM": {
      const batchId = state.claims.find((c) => c.id === action.claimId)?.batchId;
      return applyAndPromote(state, cancelClaim(state, action.claimId), batchId, action.now ?? Date.now(), "Claim cancelled — quantity returned");
    }
    case "JOIN_WAITLIST":
      return apply(state, joinWaitlist(state, action.batchId, action.recipientId, action.qty, action.now), "Added to waitlist — you'll be auto-claimed if quantity frees up");
    case "LEAVE_WAITLIST":
      return { ...state, waitlist: state.waitlist.filter((w) => w.id !== action.entryId), lastNotice: "Left waitlist" };
    case "SET_REQUIREMENTS":
      return {
        ...state,
        recipients: state.recipients.map((r) => (r.id === action.recipientId ? { ...r, requirements: action.requirements } : r)),
        lastNotice: "Requirements saved — matching updated",
      };
    case "CONFIRM_HANDOFF":
      return {
        ...state,
        claims: state.claims.map((c) =>
          c.id === action.claimId && c.status === "CLAIMED" ? { ...c, status: "PICKED_UP", pickedUpAt: action.now } : c,
        ),
        lastNotice: "Handoff verified",
      };
    case "UPDATE_QTY":
      return applyAndPromote(state, updateQuantity(state, action.batchId, action.totalQty), action.batchId, Date.now(), `Quantity updated to ${action.totalQty}`);
    case "REGISTER_RECIPIENT":
      return { ...state, recipients: [...state.recipients, action.recipient], lastNotice: `${action.recipient.name} added to network` };
    case "SET_AREA":
      return { ...state, recipients: state.recipients.map((r) => (action.areas[r.id] ? { ...r, area: action.areas[r.id] } : r)) };
    case "SAVE_REPORT":
      return { ...state, latestReport: action.report };
    case "SET_CAPACITY":
      return apply(state, setCapacity(state, action.recipientId, action.capacity), "Capacity updated — matching uses the new numbers");
    case "UPDATE_CLAIM": {
      const claim = state.claims.find((c) => c.id === action.claimId);
      return applyAndPromote(state, updateClaim(state, action.claimId, action.qty), claim?.batchId, action.now, action.qty === 0 ? "Claim cancelled — quantity returned" : `Claim updated to ${action.qty}`);
    }
    case "DEMO_LATE_PICKUP": {
      const target = [...state.claims].filter((c) => c.status === "CLAIMED").sort((a, b) => a.pickupBy - b.pickupBy)[0];
      if (!target) return { ...state, lastError: "No open pickups to delay — claim something first." };
      const pickupBy = action.now + action.minutesLeft * 60_000;
      return { ...state, claims: state.claims.map((c) => (c.id === target.id ? { ...c, pickupBy } : c)), lastNotice: "Demo: a pickup is now running late" };
    }
    case "UPDATE_EVENT_ORDER":
      return {
        ...state,
        events: state.events.map((e) => (e.id === action.eventId ? { ...e, foodOrdered: action.foodOrdered, predictedSurplus: action.predictedSurplus } : e)),
        lastNotice: `Catering order updated to ${action.foodOrdered}`,
      };
    case "CLEAR_ERROR":
      return { ...state, lastError: null };
    case "CLEAR_NOTICE":
      return { ...state, lastNotice: null };
  }
}

/** Recipients a broadcast reaches: accept the category and sit within range. */
export function nearbyRecipients(recipients: RecipientOrg[], category: Batch["category"], radiusMi = 5) {
  return recipients.filter((r) => r.verified && r.acceptedCategories.includes(category) && r.distanceMi <= radiusMi);
}
