"use client";

import { Info, MapPinned } from "lucide-react";
import { useId, useState } from "react";
import type { AreaNeed } from "@/lib/types";

/** Public-data food-access need for the org's census tract, with an explanation of the matching boost. Spans only (renders inside <p>). */
export function AreaNeedPill({ area }: { area: AreaNeed }) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const high = area.lowIncomeLowAccess || area.need >= 0.5;
  const label = area.lowIncomeLowAccess ? "USDA: low-income, low-access tract" : `Tract poverty ${Math.round(area.povertyRate)}%`;
  const boost = Math.round(8 * area.need);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-describedby={tipId} aria-expanded={open} onClick={() => setOpen((o) => !o)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:shadow-card ${high ? "bg-brand-50/90 text-brand-800 ring-brand-200 hover:ring-brand-500" : "bg-white/80 text-stone-700 ring-stone-200 hover:ring-brand-500"}`}>
        <MapPinned className="h-4 w-4" /> {label} <Info className="h-3.5 w-3.5 opacity-60" />
      </button>
      <span id={tipId} role="tooltip"
        className={`absolute left-0 top-full z-30 mt-2 block w-72 rounded-3xl border border-white/80 bg-white/95 p-4 text-left text-xs font-normal leading-relaxed text-stone-600 shadow-lift backdrop-blur-xl transition duration-200 ${open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"}`}>
        <span className="block font-semibold text-ink">Under-served areas get a boost</span>
        <span className="mt-1 block">
          Census tract <span className="tabular">{area.tract}</span>{area.lowIncomeLowAccess ? " is a USDA low-income, low-access tract" : ""} · poverty rate <span className="tabular">{area.povertyRate}%</span>.
          When donors post surplus, matching adds up to 8 points for high-need areas — yours gets about <b className="tabular text-brand-700">+{boost}</b>.
        </span>
        <span className="mt-2 block text-[11px] font-medium uppercase tracking-wide text-stone-400">Source: U.S. Census Geocoder + USDA Food Access Research Atlas (2019)</span>
      </span>
    </span>
  );
}
