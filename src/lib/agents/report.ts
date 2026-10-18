import { CATEGORIES, CATEGORY_LIST } from "../categories";
import type { Category, DemoState } from "../types";
import { step, type AgentStep } from "./trace";

/** Weekly impact report agent: per-donor stats for the last 7 days, the inputs for a summary and a tax letter. */
export interface DonorWeek {
  institution: string;
  contactName: string;
  email: string;
  byCategory: Record<Category, number>;
  units: number;
  lbs: number;
  co2eKg: number;
  deduction: number;
  recipients: string[];
  batches: number;
}

const WEEK = 7 * 24 * 3600_000;

export function weeklyStats(state: DemoState, now: number) {
  const claims = state.claims.filter((c) => c.status !== "CANCELLED" && now - c.claimedAt <= WEEK);
  const donors = new Map<string, DonorWeek>();
  for (const c of claims) {
    const b = state.batches.find((x) => x.id === c.batchId);
    const r = state.recipients.find((x) => x.id === c.recipientId);
    if (!b) continue;
    const acc = state.accounts.find((a) => a.role === "donor" && a.orgName === b.institution);
    const d = donors.get(b.institution) ?? {
      institution: b.institution, contactName: acc?.contactName ?? "Events & Sustainability Office", email: acc?.email ?? "",
      byCategory: Object.fromEntries(CATEGORY_LIST.map((k) => [k, 0])) as Record<Category, number>,
      units: 0, lbs: 0, co2eKg: 0, deduction: 0, recipients: [], batches: 0,
    };
    const cfg = CATEGORIES[b.category];
    d.byCategory[b.category] += c.qty;
    d.units += c.qty;
    d.lbs += c.qty * cfg.lbsPerUnit;
    d.co2eKg += c.qty * cfg.lbsPerUnit * cfg.co2ePerLb;
    d.deduction += c.qty * cfg.valuePerUnit * (b.category === "food" ? 1.5 : 1);
    if (r && !d.recipients.includes(r.name)) d.recipients.push(r.name);
    donors.set(b.institution, d);
  }
  const list = [...donors.values()].map((d) => ({ ...d, lbs: Math.round(d.lbs), co2eKg: Math.round(d.co2eKg), deduction: Math.round(d.deduction), batches: new Set(claims.filter((c) => state.batches.find((b) => b.id === c.batchId)?.institution === d.institution).map((c) => c.batchId)).size }));
  const steps: AgentStep[] = [
    step("Pulling this week's activity", [`${claims.length} claims in the last 7 days`, `${list.length} donor institution${list.length === 1 ? "" : "s"}`]),
    step("Computing impact per donor", list.map((d) => `${d.institution}: ${d.units} units · ${d.lbs.toLocaleString()} lbs · ~$${d.deduction.toLocaleString()} deductible`)),
  ];
  return { donors: list, totals: { units: list.reduce((a, d) => a + d.units, 0), lbs: list.reduce((a, d) => a + d.lbs, 0), co2eKg: list.reduce((a, d) => a + d.co2eKg, 0), recipients: new Set(list.flatMap((d) => d.recipients)).size }, steps };
}

export function localLetter(d: DonorWeek, weekOf: string) {
  const cats = CATEGORY_LIST.filter((c) => d.byCategory[c] > 0).map((c) => `${d.byCategory[c]} ${CATEGORIES[c].unit}`).join(", ");
  return `Dear ${d.contactName},

Thank you for donating surplus through Not Wasted during the week of ${weekOf}. ${d.institution} contributed ${cats}, received by ${d.recipients.join(", ")}.

That is about ${d.lbs.toLocaleString()} lbs kept out of landfill and roughly ${d.co2eKg.toLocaleString()} kg CO2e avoided.

For your records: the estimated value of these contributions is $${d.deduction.toLocaleString()}. Food donations may qualify for the enhanced deduction under IRS §170(e)(3); goods are valued at fair market value. This letter is an estimate, not tax advice. Please confirm amounts with your tax advisor. No goods or services were provided in exchange for these donations.

With gratitude,
The Not Wasted network`;
}

export function localSummary(t: { units: number; lbs: number; co2eKg: number; recipients: number }, donors: DonorWeek[]) {
  const top = [...donors].sort((a, b) => b.units - a.units)[0];
  return `This week the network rescued ${t.units.toLocaleString()} units (${t.lbs.toLocaleString()} lbs, ~${t.co2eKg.toLocaleString()} kg CO2e avoided) for ${t.recipients} community organizations.${top ? ` ${top.institution} led with ${top.units} units.` : ""} Next week: register recurring events early so food banks can plan cold storage.`;
}
