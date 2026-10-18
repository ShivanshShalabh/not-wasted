import { NextResponse } from "next/server";
import type { DemoState } from "@/lib/types";

/** Agents are stateless: the client posts its current network state and applies the returned plan. */
export async function readState(req: Request): Promise<{ state: DemoState; now: number; body: Record<string, unknown> } | NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const state = body.state as DemoState | undefined;
  if (!state || !Array.isArray(state.batches) || !Array.isArray(state.claims) || !Array.isArray(state.recipients))
    return NextResponse.json({ error: "Missing state {batches, claims, recipients, …}" }, { status: 400 });
  return { state, now: Number(body.now) || Date.now(), body };
}
