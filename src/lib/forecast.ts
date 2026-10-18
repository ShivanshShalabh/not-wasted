import type { EventType } from "./types";

/** Historical no-show rates by event type (seed values; replaced by app history over time). */
export const NO_SHOW: Record<EventType, number> = {
  "Career Fair": 0.15,
  Conference: 0.2,
  "Medical Rounds": 0.12,
  "Corporate Event": 0.25,
  Gala: 0.08,
  Other: 0.18,
};

export const WEATHER = { Clear: 1, Rain: 1.35, Snow: 1.8, Heat: 1.15 } as const;
export type Weather = keyof typeof WEATHER;

export function predictSurplus(input: { rsvps: number; foodOrdered: number; eventType: EventType; weather?: Weather }) {
  const noShow = Math.min(0.9, NO_SHOW[input.eventType] * WEATHER[input.weather ?? "Clear"]);
  const expectedAttendance = Math.round(input.rsvps * (1 - noShow));
  const surplus = Math.max(0, input.foodOrdered - expectedAttendance);
  const confidence = input.rsvps > 0 ? Math.max(0.55, 0.92 - noShow / 2) : 0.5;
  return { noShow, expectedAttendance, surplus, confidence };
}
