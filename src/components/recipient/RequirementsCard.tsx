"use client";

import { ClipboardList, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import type { RecipientOrg } from "@/lib/types";
import { btn, inputCls, Modal } from "../ui";

const EXAMPLE = "We serve a largely Muslim community, so no pork — halal preferred. Several clients have severe nut allergies, so nut-free only. No refrigeration on site after 6pm.";

/** The org's free-text requirements; drives dietary checks and semantic matching. Compact one-row summary + modal editor. */
export function RequirementsCard({ org }: { org: RecipientOrg }) {
  const { dispatch } = useNotWasted();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(org.requirements ?? "");
  const has = !!org.requirements?.trim();
  const edit = () => { setText(org.requirements ?? ""); setOpen(true); };
  const save = () => { dispatch({ type: "SET_REQUIREMENTS", recipientId: org.id, requirements: text.trim() }); setOpen(false); };

  return (
    <>
      <button onClick={edit}
        className="group flex w-full items-center gap-4 rounded-3xl border border-white/70 bg-white/85 px-5 py-4 text-left shadow-card ring-1 ring-brand-900/[0.04] backdrop-blur-xl transition duration-500 ease-out hover:-translate-y-1 hover:shadow-lift hover:ring-brand-200 active:scale-[0.99]">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"><ClipboardList className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Your requirements</div>
          <p className={`mt-0.5 line-clamp-1 text-sm ${has ? "text-stone-600" : "text-stone-400"}`}>
            {has ? org.requirements : "Tell us about allergies, dietary rules and storage limits — we'll flag conflicts and rank donations for you."}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-brand-700 transition group-hover:bg-brand-50">
          {has ? <><Pencil className="h-3.5 w-3.5" /> Edit</> : <><Plus className="h-4 w-4" /> Add</>}
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Your requirements">
        <p className="mb-4 text-sm leading-relaxed text-stone-500">Describe dietary restrictions, allergies, and anything you can&apos;t accept. Food donations are checked against this using vision-detected allergens and dietary tags.</p>
        <textarea autoFocus rows={6} className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} />
        {!text && <button className="mt-2 text-sm font-medium text-brand-700 hover:underline" onClick={() => setText(EXAMPLE)}>Use an example</button>}
        <div className="mt-6 flex justify-end gap-2">
          <button className={btn.ghost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btn.primary} onClick={save}>Save requirements</button>
        </div>
      </Modal>
    </>
  );
}
