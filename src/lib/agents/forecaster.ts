import { NO_SHOW, predictSurplus } from "../forecast";
import type { DemoState, EventType } from "../types";
import { step, type AgentStep } from "./trace";

/**
 * Recurring-event forecaster: compares predicted vs actual leftovers per event type,
 * learns a calibrated no-show rate, and recommends ordering less catering next time.
 */
export interface PastEvent { name: string; eventType: EventType; rsvps: number; foodOrdered: number; actualLeftover: number }

/**
 * Demo history (synthetic, clearly labelled in the UI): past campus events with the leftover counts
 * donors confirmed at the T-45 ping. Real confirmed events from the app are added on top.
 */
export const DEMO_HISTORY: PastEvent[] = [
  { name: "Fall Engineering Career Fair", eventType: "Career Fair", rsvps: 280, foodOrdered: 380, actualLeftover: 165 },
  { name: "Spring Career Fair", eventType: "Career Fair", rsvps: 310, foodOrdered: 400, actualLeftover: 152 },
  { name: "Business School Recruiting Day", eventType: "Career Fair", rsvps: 190, foodOrdered: 250, actualLeftover: 104 },
  { name: "Medical Grand Rounds (Sept)", eventType: "Medical Rounds", rsvps: 210, foodOrdered: 280, actualLeftover: 96 },
  { name: "Medical Grand Rounds (Oct)", eventType: "Medical Rounds", rsvps: 225, foodOrdered: 300, actualLeftover: 104 },
  { name: "Industry Partners Breakfast", eventType: "Corporate Breakfast", rsvps: 300, foodOrdered: 330, actualLeftover: 118 },
  { name: "Alumni Board Breakfast", eventType: "Corporate Breakfast", rsvps: 120, foodOrdered: 140, actualLeftover: 51 },
  { name: "Research Symposium", eventType: "Conference", rsvps: 400, foodOrdered: 460, actualLeftover: 119 },
  { name: "Sustainability Summit", eventType: "Conference", rsvps: 260, foodOrdered: 300, actualLeftover: 83 },
  { name: "Scholarship Gala", eventType: "Gala", rsvps: 240, foodOrdered: 260, actualLeftover: 31 },
];

export interface TypeModel { eventType: EventType; n: number; defaultNoShow: number; learnedNoShow: number; errBefore: number; errAfter: number }

/** No-show rate implied by an event's actual leftovers: leftover = ordered − attended. */
const impliedNoShow = (e: PastEvent) => Math.min(0.9, Math.max(0, 1 - (e.foodOrdered - e.actualLeftover) / e.rsvps));

export function learn(history: PastEvent[]) {
  const types = [...new Set(history.map((e) => e.eventType))];
  const models: TypeModel[] = types.map((t) => {
    const evs = history.filter((e) => e.eventType === t);
    const learnedNoShow = evs.reduce((a, e) => a + impliedNoShow(e), 0) / evs.length;
    // Leave-one-out mean absolute % error, before (default rates) and after (learned rates).
    const pct = (pred: number, e: PastEvent) => Math.abs(pred - e.actualLeftover) / Math.max(1, e.actualLeftover);
    const errBefore = evs.reduce((a, e) => a + pct(predictSurplus({ ...e }).surplus, e), 0) / evs.length;
    const errAfter = evs.reduce((a, e) => {
      const rest = evs.filter((x) => x !== e);
      const ns = rest.length ? rest.reduce((s, x) => s + impliedNoShow(x), 0) / rest.length : NO_SHOW[t];
      return a + pct(Math.max(0, e.foodOrdered - Math.round(e.rsvps * (1 - ns))), e);
    }, 0) / evs.length;
    return { eventType: t, n: evs.length, defaultNoShow: NO_SHOW[t], learnedNoShow, errBefore, errAfter };
  });
  return models;
}

export interface Recommendation { eventId: string; name: string; eventType: EventType; rsvps: number; foodOrdered: number; expectedAttendance: number; forecastLeftover: number; recommendedOrder: number; cutPct: number }

/** For upcoming events: learned forecast, and an order size that leaves a 5% buffer. */
export function recommend(state: DemoState, models: TypeModel[], now: number): Recommendation[] {
  return state.events.filter((e) => !e.batchId && e.end > now).map((e) => {
    const m = models.find((x) => x.eventType === e.eventType);
    const ns = m?.learnedNoShow ?? NO_SHOW[e.eventType];
    const expectedAttendance = Math.round(e.rsvps * (1 - ns));
    const recommendedOrder = Math.ceil(expectedAttendance * 1.05);
    return {
      eventId: e.id, name: e.name, eventType: e.eventType, rsvps: e.rsvps, foodOrdered: e.foodOrdered, expectedAttendance,
      forecastLeftover: Math.max(0, e.foodOrdered - expectedAttendance), recommendedOrder,
      cutPct: Math.max(0, Math.round((1 - recommendedOrder / e.foodOrdered) * 100)),
    };
  });
}

/** Confirmed leftovers from this app's own events count as history too. */
export function historyFrom(state: DemoState): PastEvent[] {
  return state.events.flatMap((e) => {
    const b = e.batchId && state.batches.find((x) => x.id === e.batchId);
    return b ? [{ name: e.name, eventType: e.eventType, rsvps: e.rsvps, foodOrdered: e.foodOrdered, actualLeftover: b.totalQty }] : [];
  });
}

export function runForecaster(state: DemoState, now: number) {
  const own = historyFrom(state);
  const history = [...DEMO_HISTORY, ...own];
  const models = learn(history);
  const recs = recommend(state, models, now);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const steps: AgentStep[] = [
    step("Loading event history", [`${DEMO_HISTORY.length} past events (demo history)`, `${own.length} events confirmed in this app`]),
    step("Learning no-show rates", models.map((m) => `${m.eventType}: ${pct(m.defaultNoShow)} → ${pct(m.learnedNoShow)} (${m.n} events)`)),
    step("Back-testing accuracy", models.map((m) => `${m.eventType}: error ${pct(m.errBefore)} → ${pct(m.errAfter)}`)),
    step("Advising upcoming events", recs.length ? recs.map((r) => `${r.name}: order ${r.recommendedOrder} instead of ${r.foodOrdered} (−${r.cutPct}%)`) : ["No upcoming events registered"]),
  ];
  return { models, recs, steps };
}
