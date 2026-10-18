import { distanceMi } from "../auth";
import { CATEGORIES } from "../categories";
import type { Batch, Claim, RecipientOrg } from "../types";
import { step, type AgentStep } from "./trace";

/** Route planner: orders a recipient's open pickups by deadline-aware nearest-neighbour and checks vehicle needs. */
export interface Stop { claim: Claim; batch: Batch; lat: number; lng: number }
export interface PlannedStop extends Stop { order: number; driveMin: number; arriveAt: number; late: boolean; warnings: string[] }

const MPH = 22; // average urban speed for Nashville surface streets
const LOAD_MIN = 10;

export const driveMinutes = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.round((distanceMi(a, b) * 1.3 / MPH) * 60); // ×1.3 street detour factor

export function planRoute(org: RecipientOrg, start: { lat: number; lng: number }, stops: Stop[], now: number): { route: PlannedStop[]; totalMin: number; totalMi: number; steps: AgentStep[] } {
  const left = [...stops];
  const route: PlannedStop[] = [];
  let at = start;
  let clock = now;
  let miles = 0;
  while (left.length) {
    // Earliest-deadline-first, tempered by drive time; stops we can no longer reach in time go last.
    left.sort((x, y) => cost(x) - cost(y));
    const s = left.shift()!;
    const d = driveMinutes(at, s);
    clock += d * 60_000;
    miles += distanceMi(at, s) * 1.3;
    const warnings: string[] = [];
    if (s.batch.attributes.needsTruck && !org.hasTruck) warnings.push("Needs a truck — ask the donor to deliver or book a hub pickup");
    if (s.batch.attributes.twoPersonLift) warnings.push("Bring a second person for lifting");
    if (s.batch.category === "food" && (s.batch.attributes.storage === "Refrigerated" || s.batch.attributes.storage === "Frozen")) warnings.push(org.coldStorage ? "Cold chain: bring insulated coolers" : "No cold storage on site — serve the same day");
    if (s.batch.attributes.storage === "Warm/Insulated") warnings.push("Hot food: bring insulated carriers");
    route.push({ ...s, order: route.length + 1, driveMin: d, arriveAt: clock, late: clock > s.claim.pickupBy, warnings });
    clock += LOAD_MIN * 60_000;
    at = s;
  }
  function cost(s: Stop) {
    const arrive = clock + driveMinutes(at, s) * 60_000;
    const slackMin = (s.claim.pickupBy - arrive) / 60_000;
    return driveMinutes(at, s) + (slackMin < 0 ? 1000 : slackMin * 0.25);
  }

  const totalMin = Math.round((clock - now) / 60_000);
  const steps: AgentStep[] = [
    step("Collecting open pickups", stops.map((s) => `${s.claim.qty} ${CATEGORIES[s.batch.category].unit} · ${s.batch.title} — window closes ${new Date(s.claim.pickupBy).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`)),
    step("Locating stops", [`${stops.length} donor addresses geocoded`], "U.S. Census Geocoder"),
    step("Ordering the run", route.map((r) => `${r.order}. ${r.batch.institution} — ${r.driveMin} min drive${r.late ? " · ⚠ arrives after window" : ""}`)),
    step("Checking vehicle & storage", route.flatMap((r) => r.warnings.map((w) => `${r.batch.title}: ${w}`)).concat(route.every((r) => !r.warnings.length) ? ["No special handling needed"] : [])),
  ];
  return { route, totalMin, totalMi: Math.round(miles * 10) / 10, steps };
}

export function localChecklist(org: RecipientOrg, route: PlannedStop[], totalMin: number) {
  const t = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return [
    `Pickup run for ${org.name} — about ${totalMin} min total.`,
    `Before you leave: ${org.hasTruck ? "take the truck" : "take the van"}${route.some((r) => r.warnings.some((w) => w.includes("cooler"))) ? ", insulated coolers" : ""}${route.some((r) => r.warnings.some((w) => w.includes("carrier"))) ? ", hot-food carriers" : ""}, and a phone for photos.`,
    ...route.map((r) => `${r.order}. ${r.batch.institution} — ${r.batch.address}. Arrive ~${t(r.arriveAt)}. Collect ${r.claim.qty} ${CATEGORIES[r.batch.category].unit} (${r.batch.title}).${r.warnings.length ? ` ${r.warnings.join(". ")}.` : ""} Tap "Confirm pickup" in the app.`),
    "Back at base: log temperatures for cold food and store everything before serving.",
  ].join("\n");
}
