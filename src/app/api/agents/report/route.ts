import { NextResponse } from "next/server";
import { localLetter, localSummary, weeklyStats } from "@/lib/agents/report";
import { step } from "@/lib/agents/trace";
import { writeWithAI } from "@/lib/oci-service";
import { readState } from "../_shared";

export async function POST(req: Request) {
  const r = await readState(req);
  if (r instanceof NextResponse) return r;
  const { donors, totals, steps } = weeklyStats(r.state, r.now);
  const weekOf = new Date(r.now - 6 * 24 * 3600_000).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const summary = await writeWithAI(
    `Write a 3-sentence weekly sustainability summary for the Not Wasted surplus network in Nashville. Data: ${JSON.stringify({ totals, donors })}. Plain text, specific numbers, no hype.`,
    () => localSummary(totals, donors),
  );
  const letters = await Promise.all(
    donors.map(async (d) => {
      const l = await writeWithAI(
        `Write a short donation acknowledgment letter (under 170 words) from the Not Wasted network to ${d.contactName} at ${d.institution} for the week of ${weekOf}. Data: ${JSON.stringify(d)}. Mention items, recipients, lbs diverted, CO2e, and the estimated deductible value with an "estimate, not tax advice" disclaimer and "no goods or services were provided". Plain text.`,
        () => localLetter(d, weekOf),
      );
      return { institution: d.institution, to: d.email, subject: `Your Not Wasted impact — week of ${weekOf}`, body: l.text, source: l.source };
    }),
  );
  steps.push(step("Writing summary & letters", [`1 network summary`, `${letters.length} donor letter${letters.length === 1 ? "" : "s"}`, "Held for review — nothing is sent automatically"], summary.source === "oci" ? "OCI Generative AI" : undefined));
  return NextResponse.json({ steps, totals, donors, weekOf, summary: summary.text, letters });
}
