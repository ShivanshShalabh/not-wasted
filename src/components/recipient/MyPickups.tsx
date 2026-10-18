"use client";

import { CheckCircle2, Clock, ListOrdered, MapPin, PackageOpen, Truck } from "lucide-react";
import { useNotWasted } from "@/context/NotWastedContext";
import { CATEGORIES } from "@/lib/categories";
import { countdown, timeOf } from "@/lib/format";
import type { RecipientOrg } from "@/lib/types";
import { Pill } from "../AttributeTags";
import { Badge, btn, Card, CategoryChip, EmptyState, MotionList, SectionTitle } from "../ui";
import { ClaimEditor } from "./ClaimEditor";

export function MyPickups({ org, onBrowse }: { org: RecipientOrg; onBrowse?: () => void }) {
  const { state, dispatch, now } = useNotWasted();
  const claims = state.claims.filter((c) => c.recipientId === org.id && c.status !== "CANCELLED").sort((a, b) => b.claimedAt - a.claimedAt);
  const waiting = state.waitlist
    .filter((w) => w.recipientId === org.id)
    .map((w) => ({ w, b: state.batches.find((x) => x.id === w.batchId), pos: state.waitlist.filter((x) => x.batchId === w.batchId && x.joinedAt < w.joinedAt).length + 1 }))
    .filter((x) => x.b);

  if (!claims.length && !waiting.length) {
    return (
      <EmptyState icon={<PackageOpen className="h-6 w-6" />} title="No pickups yet"
        action={onBrowse && <button className={btn.primary} onClick={onBrowse}>Browse available donations</button>}>
        When you claim a donation it shows up here with the address, pickup window and a button to confirm the handoff.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-10">
      {claims.length > 0 && (
        <section>
          <SectionTitle hint="Head to the address before the window closes, then confirm the handoff.">Your pickups</SectionTitle>
          <MotionList className="grid gap-6 md:grid-cols-2">
            {claims.map((c) => {
              const b = state.batches.find((x) => x.id === c.batchId)!;
              const left = c.pickupBy - now;
              const isFood = b.category === "food";
              const unit = CATEGORIES[b.category].unit;
              return (
                <Card key={c.id} interactive className="group flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CategoryChip category={b.category} />
                      <h3 className="mt-3 truncate text-lg font-semibold tracking-tight">{b.title}</h3>
                      <div className="mt-0.5 text-sm text-stone-500">{b.institution} · claimed {timeOf(c.claimedAt)}</div>
                    </div>
                    {c.status === "PICKED_UP" ? <Pill className="!px-2.5 !py-1"><CheckCircle2 className="h-3 w-3" /> Picked up</Pill> : left < 0 ? <Badge tone="red">Missed window</Badge> : <Pill tone="brand" className="!px-2.5 !py-1"><Clock className="h-3 w-3" /> Awaiting pickup</Pill>}
                  </div>

                  <div className="mt-5 font-display text-4xl font-bold leading-none text-brand-700">{c.qty} <span className="font-sans text-sm font-normal text-stone-500">{unit}</span></div>

                  <dl className="mt-5 space-y-2.5 text-sm text-stone-600">
                    <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 transition-transform duration-300 group-hover:-translate-y-0.5" /> {b.address}</div>
                    <div className="flex items-start gap-2"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 transition-transform duration-300 group-hover:translate-x-0.5" /> {b.transport} · ETA <span className="tabular">{c.etaMinutes}</span> min{b.attributes.needsTruck ? " · truck required" : ""}</div>
                    {c.status === "CLAIMED" && (
                      <div className={`flex items-center gap-2 font-medium ${left < 30 * 60_000 ? "text-red-600" : "text-stone-800"}`}>
                        <Clock className="h-4 w-4 shrink-0" /> {isFood ? "Safe temperature window" : "Pickup window"}: <span className="tabular">{countdown(left)}</span>
                      </div>
                    )}
                  </dl>

                  {c.status === "CLAIMED" && (
                    <div className="mt-auto space-y-3 pt-6">
                      <ClaimEditor claim={c} batch={b} org={org} />
                      <button className={`${btn.primary} w-full`} onClick={() => dispatch({ type: "CONFIRM_HANDOFF", claimId: c.id, now: Date.now() })}><CheckCircle2 className="h-4 w-4" /> Confirm pickup</button>
                    </div>
                  )}
                </Card>
              );
            })}
          </MotionList>
        </section>
      )}

      {waiting.length > 0 && (
        <section>
          <SectionTitle hint="If any quantity frees up, we'll claim it for you automatically.">Waitlist</SectionTitle>
          <MotionList className="grid gap-4 md:grid-cols-2">
            {waiting.map(({ w, b, pos }) => (
              <div key={w.id} className="group flex items-center gap-4 rounded-3xl border border-white/70 bg-white/85 px-5 py-4 shadow-card ring-1 ring-brand-900/[0.04] backdrop-blur-xl transition duration-500 ease-out hover:-translate-y-1 hover:shadow-lift hover:ring-brand-200">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                  <ListOrdered className="h-3.5 w-3.5 opacity-60" />
                  <span className="tabular text-sm font-bold leading-none">#{pos}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{b!.title}</div>
                  <div className="truncate text-sm text-stone-500">
                    <span className="tabular">{w.qty}</span> {CATEGORIES[b!.category].unit} · {b!.institution} · {b!.pickupBy > now ? <>closes in <span className="tabular">{countdown(b!.pickupBy - now)}</span></> : "window closed"}
                  </div>
                </div>
                <button className={btn.ghost} onClick={() => dispatch({ type: "LEAVE_WAITLIST", entryId: w.id })}>Leave</button>
              </div>
            ))}
          </MotionList>
        </section>
      )}
    </div>
  );
}
