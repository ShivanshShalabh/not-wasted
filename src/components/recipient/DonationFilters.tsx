"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, SlidersHorizontal, Truck, X } from "lucide-react";
import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { DIETARY_FILTERS, type DietaryFilter } from "@/lib/dietary";
import type { Category } from "@/lib/types";
import { CATEGORY_STYLE } from "../ui";

export type TransportFilter = "all" | "delivered" | "pickup";

export interface Filters {
  categories: Category[];
  transport: TransportFilter;
  dietary: DietaryFilter[];
  fitsRequirements: boolean;
  hideQualityFlags: boolean;
}

export const NO_FILTERS: Filters = { categories: [], transport: "all", dietary: [], fitsRequirements: false, hideQualityFlags: false };

/** "Delivery" = the donor brings it; everything else needs the recipient (or a hub) to collect it. */
export const matchesTransport = (t: string, f: TransportFilter) => f === "all" || (f === "delivered" ? t === "Donor delivers" : t !== "Donor delivers");

const TRANSPORT_OPTIONS: { value: TransportFilter; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "delivered", label: "Delivery" },
  { value: "pickup", label: "Pickup" },
];

const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition duration-200 hover:-translate-y-px active:scale-[0.97] ${on ? "bg-brand-900 text-white shadow-[0_6px_14px_-6px_rgb(61_26_12/0.5)]" : "bg-white/80 text-stone-600 ring-1 ring-stone-200 backdrop-blur hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"}`;

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Switch({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className="flex items-start gap-3 rounded-2xl p-2 text-left transition hover:bg-brand-50/60 disabled:cursor-not-allowed disabled:opacity-40">
      <span className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-brand-600" : "bg-stone-300"}`}>
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className={`h-4 w-4 rounded-full bg-white shadow ${on ? "ml-[18px]" : "ml-0.5"}`} />
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-sm text-stone-500">{hint}</span>
      </span>
    </button>
  );
}

/** Category and delivery filters, with the live result count and a clear-all. */
export function DonationFilters({ value, onChange, categories, shown, total }: {
  value: Filters; onChange: (f: Filters) => void; categories: Category[]; shown: number; total: number;
}) {
  const active = value.categories.length + Number(value.transport !== "all") + value.dietary.length + Number(value.fitsRequirements) + Number(value.hideQualityFlags);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={!value.categories.length} className={chip(!value.categories.length)} onClick={() => onChange({ ...value, categories: [] })}>All</button>
      {categories.map((c) => {
        const Icon = CATEGORY_STYLE[c].icon;
        const on = value.categories.includes(c);
        return (
          <button key={c} type="button" aria-pressed={on} className={chip(on)} onClick={() => onChange({ ...value, categories: toggle(value.categories, c) })}>
            <Icon className="h-3.5 w-3.5" /> {CATEGORIES[c].label}
          </button>
        );
      })}
      <span className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" />
      <div role="radiogroup" aria-label="Delivery" className="inline-flex items-center gap-1 rounded-full bg-white/70 p-1 ring-1 ring-stone-200 backdrop-blur">
        <Truck className="ml-2 h-3.5 w-3.5 text-stone-500" aria-hidden />
        {TRANSPORT_OPTIONS.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value.transport === o.value} onClick={() => onChange({ ...value, transport: o.value })}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${value.transport === o.value ? "bg-brand-900 text-white" : "text-stone-600 hover:bg-brand-50 hover:text-brand-700"}`}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3 text-sm text-stone-500">
        <span>Showing <b className="tabular font-semibold text-ink">{shown}</b> of <span className="tabular">{total}</span></span>
        <AnimatePresence>
          {active > 0 && (
            <motion.button initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} onClick={() => onChange(NO_FILTERS)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-stone-600 transition hover:bg-brand-50 hover:text-brand-700"><X className="h-3.5 w-3.5" /> Clear</motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Dietary-needs toggle and panel; sits beside the org's written requirements. */
export function DietaryNeeds({ value, onChange, hasRequirements }: { value: Filters; onChange: (f: Filters) => void; hasRequirements: boolean }) {
  const [open, setOpen] = useState(false);
  const extra = value.dietary.length + Number(value.fitsRequirements) + Number(value.hideQualityFlags);
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 transition duration-200 active:scale-[0.97] ${open || extra ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white/80 text-stone-600 ring-stone-200 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"} hover:-translate-y-px`}>
        <SlidersHorizontal className="h-4 w-4" /> Dietary needs
        {extra > 0 && <span className="tabular rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">{extra}</span>}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="inline-flex"><ChevronDown className="h-3.5 w-3.5" /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }} className="basis-full overflow-hidden">
            <div className="grid gap-6 rounded-3xl border border-white/70 bg-white/85 p-6 shadow-card ring-1 ring-brand-900/[0.04] backdrop-blur-xl md:grid-cols-[1.6fr_1fr]">
              <div>
                <div className="text-sm font-semibold">Only show food that is…</div>
                <p className="mt-0.5 text-sm text-stone-500">Applies to food donations. Pick as many as you need.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(DIETARY_FILTERS) as DietaryFilter[]).map((d) => (
                    <button key={d} type="button" aria-pressed={value.dietary.includes(d)} className={chip(value.dietary.includes(d))}
                      onClick={() => onChange({ ...value, dietary: toggle(value.dietary, d) })}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1 md:border-l md:border-stone-100 md:pl-6">
                <Switch on={value.fitsRequirements} disabled={!hasRequirements} onChange={(v) => onChange({ ...value, fitsRequirements: v })}
                  label="Fits our requirements" hint={hasRequirements ? "Hide food that conflicts with what you wrote" : "Add your requirements to use this"} />
                <Switch on={value.hideQualityFlags} onChange={(v) => onChange({ ...value, hideQualityFlags: v })}
                  label="Hide quality warnings" hint="Skip anything not rated good to donate" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
