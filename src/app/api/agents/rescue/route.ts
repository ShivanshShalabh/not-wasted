import { NextResponse } from "next/server";
import { localRescueText, planRescue } from "@/lib/agents/rescue";
import { step } from "@/lib/agents/trace";
import { CATEGORIES } from "@/lib/categories";
import { writeWithAI } from "@/lib/oci-service";
import { readState } from "../_shared";

export async function POST(req: Request) {
  const r = await readState(req);
  if (r instanceof NextResponse) return r;
  const { cases, steps } = planRescue(r.state, r.now);
  const messages = await Promise.all(
    cases.map(async (c) => {
      const to = c.plan === "waitlist" ? c.waitlistNext!.name : c.rematch[0]?.name;
      if (!to) return null;
      const msg = await writeWithAI(
        `Write one urgent SMS (under 300 characters, no emojis) from the Not Wasted network to ${to}: ${c.claim.qty} ${CATEGORIES[c.batch.category].unit} of "${c.batch.title}" at ${c.batch.address} need pickup within ${Math.max(20, c.minutesLeft + 30)} minutes because the original pickup fell through. Ask them to reply YES to claim. Return only the SMS text.`,
        () => localRescueText(c, to),
      );
      return { claimId: c.claim.id, to, text: msg.text.replace(/^"|"$/g, ""), source: msg.source };
    }),
  );
  if (cases.length) steps.push(step("Drafting urgent messages", messages.filter(Boolean).map((m) => `To ${m!.to}`), messages.some((m) => m?.source === "oci") ? "OCI Generative AI" : undefined));
  return NextResponse.json({ steps, cases, messages: messages.filter(Boolean) });
}
