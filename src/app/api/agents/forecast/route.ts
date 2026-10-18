import { NextResponse } from "next/server";
import { runForecaster } from "@/lib/agents/forecaster";
import { step } from "@/lib/agents/trace";
import { writeWithAI } from "@/lib/oci-service";
import { readState } from "../_shared";

export async function POST(req: Request) {
  const r = await readState(req);
  if (r instanceof NextResponse) return r;
  const out = runForecaster(r.state, r.now);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const local = () => {
    const worst = [...out.models].sort((a, b) => b.learnedNoShow - b.defaultNoShow - (a.learnedNoShow - a.defaultNoShow))[0];
    const rec = out.recs[0];
    return `${worst ? `${worst.eventType}s lose more guests than planned (${pct(worst.learnedNoShow)} no-show vs ${pct(worst.defaultNoShow)} assumed). ` : ""}${rec ? `For ${rec.name}, order about ${rec.recommendedOrder} portions instead of ${rec.foodOrdered} (−${rec.cutPct}%); that still leaves a 5% buffer.` : "Register upcoming events to get order-size advice."}`;
  };
  const advice = await writeWithAI(
    `You advise a university events office on catering. Data: learned no-show rates ${JSON.stringify(out.models)} and upcoming-event recommendations ${JSON.stringify(out.recs)}. In 2–3 sentences, tell them how much to cut catering and why, citing numbers. Plain text.`,
    local,
  );
  out.steps.push(step("Writing advice", [], advice.source === "oci" ? "OCI Generative AI" : undefined));
  return NextResponse.json({ ...out, advice: advice.text });
}
