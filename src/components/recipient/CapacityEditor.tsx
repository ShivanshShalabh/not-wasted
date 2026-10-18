"use client";

import { Info, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { CATEGORIES } from "@/lib/categories";
import type { Category, RecipientOrg } from "@/lib/types";
import { AnimatedNumber, btn, CATEGORY_STYLE, Modal } from "../ui";
import { QtyStepper, qtyError } from "./QtyStepper";

const MAX = 100_000;
const STEP: Record<Category, number> = { food: 10, furniture: 1, clothing: 10, other: 5 };
const PRESETS: Record<Category, number[]> = { food: [0, 50, 100, 250], furniture: [0, 5, 10, 25], clothing: [0, 50, 100, 250], other: [0, 10, 25, 50] };

/** Header stat pills for remaining space per accepted category, plus an editor to update them. */
export function CapacityEditor({ org }: { org: RecipientOrg }) {
  const { dispatch } = useNotWasted();
  const [open, setOpen] = useState(false);
  const cats = org.acceptedCategories;
  const initial = () => Object.fromEntries(cats.map((c) => [c, String(org.capacity[c] ?? 0)])) as Record<Category, string>;
  const [draft, setDraft] = useState<Record<Category, string>>(initial);
  const errors = Object.fromEntries(cats.map((c) => [c, qtyError(draft[c] ?? "", 0, MAX)])) as Record<Category, string | null>;
  const invalid = cats.some((c) => errors[c]);
  const changed = cats.some((c) => Number(draft[c]) !== (org.capacity[c] ?? 0));

  const edit = () => { setDraft(initial()); setOpen(true); };
  const save = () => {
    if (invalid) return;
    dispatch({ type: "SET_CAPACITY", recipientId: org.id, capacity: Object.fromEntries(cats.map((c) => [c, Number(draft[c])])) });
    setOpen(false);
  };

  return (
    <>
      {cats.map((c) => {
        const Icon = CATEGORY_STYLE[c].icon;
        return (
          <div key={c} title={`Room left for ${CATEGORIES[c].label.toLowerCase()}`} className="group flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/85 px-3.5 py-2 shadow-card backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><Icon className="h-4 w-4" /></span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-bold leading-tight text-brand-700"><AnimatedNumber value={org.capacity[c] ?? 0} /> <span className="font-sans text-xs font-normal text-stone-500">{CATEGORIES[c].unit}</span></span>
              <span className="block text-xs text-stone-500">{CATEGORIES[c].label} space</span>
            </span>
          </div>
        );
      })}
      <button type="button" onClick={edit} className={`${btn.secondary} min-h-11`} aria-haspopup="dialog">
        <SlidersHorizontal className="h-4 w-4" /> Edit capacity
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Update your capacity">
        <p className="mb-5 flex gap-2 rounded-2xl bg-brand-50/60 p-3.5 text-sm leading-relaxed text-stone-600 ring-1 ring-brand-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span>Capacity is how many units you can take <b className="font-semibold text-ink">right now</b>. We use it to rank donations for you and to cap how much you can claim. Claiming lowers it; cancelling gives it back.</span>
        </p>
        <div className="space-y-4">
          {cats.map((c) => {
            const Icon = CATEGORY_STYLE[c].icon;
            const err = errors[c];
            return (
              <div key={c} className="rounded-2xl border border-stone-200/80 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label htmlFor={`cap-${c}`} className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100"><Icon className="h-4 w-4" /></span>
                    <span>
                      <span className="block text-sm font-semibold">{CATEGORIES[c].label}</span>
                      <span className="block text-xs text-stone-500">In {CATEGORIES[c].unit} · now <span className="tabular">{org.capacity[c] ?? 0}</span></span>
                    </span>
                  </label>
                  <QtyStepper id={`cap-${c}`} value={draft[c] ?? ""} onChange={(v) => setDraft({ ...draft, [c]: v })} min={0} max={MAX} step={STEP[c]} label={`${CATEGORIES[c].label} capacity in ${CATEGORIES[c].unit}`} invalid={!!err} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRESETS[c].map((p) => (
                    <button key={p} type="button" onClick={() => setDraft({ ...draft, [c]: String(p) })}
                      className={`tabular min-h-9 rounded-full px-3.5 text-sm font-medium ring-1 transition ${Number(draft[c]) === p && draft[c] !== "" ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-stone-600 ring-stone-200 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"}`}>
                      {p === 0 ? "None right now" : p}
                    </button>
                  ))}
                </div>
                {err && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{err}</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className={btn.primary} disabled={invalid || !changed} onClick={save}>Save capacity</button>
        </div>
      </Modal>
    </>
  );
}
