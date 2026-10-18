import { NextResponse } from "next/server";
import { proposeSplit } from "@/lib/agents/split";
import { step } from "@/lib/agents/trace";
import { CATEGORIES } from "@/lib/categories";
import { readState } from "../_shared";

export async function POST(req: Request) {
  const r = await readState(req);
  if (r instanceof NextResponse) return r;
  const batch = r.state.batches.find((b) => b.id === r.body.batchId);
  if (!batch) return NextResponse.json({ error: "Unknown batchId" }, { status: 400 });
  const plan = proposeSplit(r.state, batch);
  const unit = CATEGORIES[batch.category].unit;
  const requests = plan.allocations.map((a) => ({
    recipientId: a.recipientId,
    channel: a.channel,
    text: `Not Wasted: ${batch.institution} has ${batch.remainingQty} ${unit} of ${batch.title}. We'd like to reserve ${a.qty} for ${a.name} (${a.reason.toLowerCase()}). Pickup by ${new Date(batch.pickupBy).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Reply YES to confirm.`,
  }));
  plan.steps.push(step("Asking each recipient to confirm", requests.map((q) => `${plan.allocations.find((a) => a.recipientId === q.recipientId)!.name} via ${q.channel}`)));
  return NextResponse.json({ ...plan, batch: { id: batch.id, title: batch.title, remainingQty: batch.remainingQty, unit }, requests });
}
