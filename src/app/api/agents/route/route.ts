import { NextResponse } from "next/server";
import { localChecklist, planRoute, type Stop } from "@/lib/agents/route";
import { step } from "@/lib/agents/trace";
import { NETWORK_CENTER } from "@/lib/auth";
import { geocodeAddress } from "@/lib/public-data/census";
import { writeWithAI } from "@/lib/oci-service";
import { readState } from "../_shared";

const locate = async (address: string) => (await geocodeAddress(address).catch(() => null)) ?? null;

export async function POST(req: Request) {
  const r = await readState(req);
  if (r instanceof NextResponse) return r;
  const org = r.state.recipients.find((x) => x.id === r.body.recipientId);
  if (!org) return NextResponse.json({ error: "Unknown recipientId" }, { status: 400 });
  const claims = r.state.claims.filter((c) => c.recipientId === org.id && c.status === "CLAIMED");
  if (!claims.length) return NextResponse.json({ steps: [step("Collecting open pickups", ["No open pickups — claim something first"])], route: [], totalMin: 0, totalMi: 0, checklist: "" });

  const start = org.area?.lat != null && org.area.lng != null ? { lat: org.area.lat, lng: org.area.lng } : ((await locate(org.address)) ?? NETWORK_CENTER);
  let missed = 0;
  const stops: Stop[] = await Promise.all(
    claims.map(async (claim) => {
      const batch = r.state.batches.find((b) => b.id === claim.batchId)!;
      const g = await locate(batch.address);
      if (!g) missed++;
      return { claim, batch, lat: g?.lat ?? NETWORK_CENTER.lat, lng: g?.lng ?? NETWORK_CENTER.lng };
    }),
  );
  const plan = planRoute(org, start, stops, r.now);
  if (missed) plan.steps[1].detail.push(`${missed} address${missed > 1 ? "es" : ""} not matched — using city center`);
  const checklist = await writeWithAI(
    `Rewrite this pickup-run plan as a clear, friendly driver checklist (numbered stops, what to bring, safety notes). Keep every time, address and quantity exactly. Plain text, under 180 words.\n\n${localChecklist(org, plan.route, plan.totalMin)}`,
    () => localChecklist(org, plan.route, plan.totalMin),
  );
  plan.steps.push(step("Writing the driver checklist", [`${plan.route.length} stop${plan.route.length === 1 ? "" : "s"} · ~${plan.totalMin} min · ${plan.totalMi} mi`], checklist.source === "oci" ? "OCI Generative AI" : undefined));
  return NextResponse.json({ ...plan, start, checklist: checklist.text });
}
