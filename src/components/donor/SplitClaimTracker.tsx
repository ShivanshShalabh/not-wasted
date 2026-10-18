"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, PackageOpen, PackagePlus, Pencil } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { myDonorData } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { countdown } from "@/lib/format";
import type { Batch, Category } from "@/lib/types";
import { Pill } from "../AttributeTags";
import { AnimatedNumber, btn, Card, CATEGORY_STYLE, CategoryChip, EmptyState, inputCls, MotionList, SegmentedBar, segmentColor } from "../ui";

export function SplitClaimTracker({ onPost }: { onPost?: () => void }) {
  const { state } = useNotWasted();
  const { batches } = myDonorData(state);
  const [cat, setCat] = useState<Category | "all">("all");
  if (!batches.length) {
    return (
      <EmptyState icon={<PackageOpen className="h-6 w-6" />} title="No donations yet"
        action={onPost && <button className={btn.primary} onClick={onPost}><PackagePlus className="h-4 w-4" /> Post your first donation</button>}>
        Post surplus with a photo, or confirm leftovers from an event. Each donation shows up here with who claimed it.
      </EmptyState>
    );
  }
  const cats = [...new Set(batches.map((b) => b.category))];
  const shown = cat === "all" ? batches : batches.filter((b) => b.category === cat);
  const chip = (on: boolean) => `inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition hover:-translate-y-px ${on ? "bg-brand-900 text-white" : "bg-white/80 text-stone-600 ring-1 ring-stone-200 hover:bg-brand-50 hover:text-brand-700"}`;
  return (
    <div className="space-y-6">
      {cats.length > 1 && (
        <div role="radiogroup" aria-label="Filter by category" className="flex flex-wrap gap-2">
          <button type="button" role="radio" aria-checked={cat === "all"} className={chip(cat === "all")} onClick={() => setCat("all")}>All</button>
          {cats.map((c) => {
            const Icon = CATEGORY_STYLE[c].icon;
            return (
              <button key={c} type="button" role="radio" aria-checked={cat === c} className={chip(cat === c)} onClick={() => setCat(c)}>
                <Icon className="h-3.5 w-3.5" /> {CATEGORIES[c].label}
              </button>
            );
          })}
        </div>
      )}
      <MotionList className="grid items-start gap-6 md:grid-cols-2">
        {shown.map((b) => <BatchTracker key={b.id} batch={b} />)}
      </MotionList>
    </div>
  );
}

function BatchTracker({ batch }: { batch: Batch }) {
  const { state, dispatch, now } = useNotWasted();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [total, setTotal] = useState(batch.totalQty);
  const claims = state.claims.filter((c) => c.batchId === batch.id && c.status !== "CANCELLED");
  const unit = CATEGORIES[batch.category].unit;
  const name = (id: string) => state.recipients.find((r) => r.id === id)?.name ?? id;
  const claimed = batch.totalQty - batch.remainingQty;

  return (
    <Card interactive className="group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CategoryChip category={batch.category} />
          <div className="mt-3 truncate text-lg font-semibold leading-snug">{batch.title}</div>
          <div className="mt-0.5 text-sm text-stone-500">{batch.institution}</div>
        </div>
        {batch.status === "FULLY_CLAIMED" ? <Pill tone="brand" className="!px-2.5 !py-1"><CheckCircle2 className="h-3 w-3" /> Fully claimed</Pill> : (
          <Pill className="!px-2.5 !py-1"><span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage-500 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sage-700" /></span> Live</Pill>
        )}
      </div>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-display text-4xl font-bold text-brand-700"><AnimatedNumber value={claimed} /></span>
        <span className="text-sm text-stone-500">of <span className="tabular">{batch.totalQty}</span> {unit} claimed</span>
      </div>
      <div className="mt-3"><SegmentedBar segments={claims.map((c) => ({ label: name(c.recipientId), qty: c.qty }))} total={batch.totalQty} /></div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-stone-500">
        {claims.map((c, i) => <span key={c.id} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${segmentColor(i)}`} />{name(c.recipientId)} · <span className="tabular">{c.qty}</span></span>)}
        {batch.remainingQty > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-stone-300" />Available · <span className="tabular">{batch.remainingQty}</span></span>}
      </div>

      <button onClick={() => setOpen(!open)} aria-expanded={open} className="mt-6 flex w-full items-center justify-between rounded-xl border-t border-stone-100 pt-4 text-sm font-medium text-stone-600 transition hover:text-brand-700">
        {claims.length ? `Manage ${claims.length} pickup${claims.length > 1 ? "s" : ""}` : "Details and matches"}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 transition-colors group-hover:bg-brand-50"><ChevronDown className="h-4 w-4" /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="overflow-hidden">
            <ul className="mt-4 space-y-2">
              {claims.map((c, i) => (
                <motion.li key={c.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-2xl bg-brand-50/50 px-4 py-3 text-sm ring-1 ring-brand-100/60 transition hover:bg-brand-50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{name(c.recipientId)}</div>
                    <div className="mt-0.5 text-xs text-stone-500 tabular">{c.qty} {unit} · ETA {c.etaMinutes} min{c.status === "CLAIMED" ? ` · ${countdown(c.pickupBy - now)} left` : ""}</div>
                  </div>
                  {c.status === "PICKED_UP" ? (
                    <Pill><CheckCircle2 className="h-3 w-3" /> Picked up</Pill>
                  ) : (
                    <button className={`${btn.secondary} !px-3 !py-1.5 text-xs`} onClick={() => dispatch({ type: "CONFIRM_HANDOFF", claimId: c.id, now: Date.now() })}>Confirm handoff</button>
                  )}
                </motion.li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-stone-500">
              {editing ? (
                <>
                  New total
                  <input type="number" min={claimed} className={`${inputCls} !w-24 !py-1.5`} value={total} onChange={(e) => setTotal(+e.target.value)} />
                  <button className={btn.ghost} onClick={() => { dispatch({ type: "UPDATE_QTY", batchId: batch.id, totalQty: total }); setEditing(false); }}>Save</button>
                  <button className={btn.ghost} onClick={() => setEditing(false)}>Cancel</button>
                </>
              ) : (
                <button className={btn.ghost} onClick={() => { setTotal(batch.totalQty); setEditing(true); }}><Pencil className="h-3.5 w-3.5" /> Update quantity</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
