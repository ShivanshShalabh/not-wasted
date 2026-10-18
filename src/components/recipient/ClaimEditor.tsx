"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Pencil } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { CATEGORIES, smallestClaim } from "@/lib/categories";
import type { Batch, Claim, RecipientOrg } from "@/lib/types";
import { btn } from "../ui";
import { QtyStepper, qtyError } from "./QtyStepper";

/** "You claimed N" with an inline editor to resize or cancel the org's open claim. */
export function ClaimEditor({ claim, batch, org }: { claim: Claim; batch: Batch; org: RecipientOrg }) {
  const { dispatch } = useNotWasted();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(claim.qty));
  const unit = CATEGORIES[batch.category].unit;
  // Growing is bounded by what's left in the batch and by the org's remaining capacity.
  const max = claim.qty + Math.min(batch.remainingQty, org.capacity[batch.category] ?? 0);
  const least = smallestClaim({ category: batch.category, remainingQty: batch.remainingQty + claim.qty });
  const err = qtyError(draft, least, max, unit);

  const save = () => {
    if (err) return;
    if (Number(draft) !== claim.qty) dispatch({ type: "UPDATE_CLAIM", claimId: claim.id, qty: Number(draft), now: Date.now() });
    setEditing(false);
  };

  return (
    <div className="rounded-2xl bg-sage-100/70 p-4 ring-1 ring-sage-500/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-[#2f6b3d]">
          <CheckCircle2 className="h-4 w-4" /> You claimed <span className="tabular">{claim.qty}</span> {unit}
        </span>
        {!editing && (
          <button type="button" onClick={() => { setDraft(String(claim.qty)); setEditing(true); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[#2f6b3d] transition hover:bg-white/70">
            <Pencil className="h-3.5 w-3.5" /> Edit claim
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {editing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <QtyStepper value={draft} onChange={setDraft} min={least} max={max} step={batch.category === "furniture" ? 1 : 5} label={`Claim quantity in ${unit}`} invalid={!!err} />
                <span className="text-xs text-stone-600">{least > 1 && <><span className="tabular">{least}</span>–</>}<span className="tabular">{max}</span> {unit}</span>
              </div>
              {err && <p role="alert" className="text-sm font-medium text-red-600">{err}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn.danger} onClick={() => dispatch({ type: "CANCEL_CLAIM", claimId: claim.id, now: Date.now() })}>Cancel claim</button>
                <span className="flex-1" />
                <button type="button" className={btn.ghost} onClick={() => setEditing(false)}>Keep</button>
                <button type="button" className={btn.primary} disabled={!!err} onClick={save}>Save</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
