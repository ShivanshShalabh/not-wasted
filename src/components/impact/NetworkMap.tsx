"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useNotWasted } from "@/context/NotWastedContext";
import { toMapXY } from "@/lib/auth";
import { Card, SectionTitle } from "../ui";

const DONOR_POS: Record<string, { x: number; y: number }> = {};
const donorPos = (name: string, i: number) => (DONOR_POS[name] ??= { x: 44 + ((i * 17) % 22), y: 46 + ((i * 11) % 18) });

/** Optional public-data points (e.g. EPA-listed pantries) drawn as hollow markers. Points outside the map window are skipped. */
export interface ExtraPoint { id: string; name: string; lat: number; lng: number }

export function NetworkMap({ extraPoints = [], extraLabel = "EPA-listed, not yet on network" }: { extraPoints?: ExtraPoint[]; extraLabel?: string } = {}) {
  const { state } = useNotWasted();
  const donors = [...new Set(state.batches.map((b) => b.institution))];
  const still = useReducedMotion();
  const extras = extraPoints
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => ({ ...p, ...toMapXY(p.lat, p.lng) }))
    .filter((p) => p.x > 5 && p.x < 95 && p.y > 5 && p.y < 75);

  return (
    <Card>
      <SectionTitle hint="Donors and recipients within the 5-mile match radius">Nashville network</SectionTitle>
      <svg viewBox="0 0 100 80" className="w-full rounded-2xl bg-[#fbf3ea] ring-1 ring-brand-100" role="img" aria-label="Map of donors and recipients">
        <defs>
          <radialGradient id="nw-glow" cx="52%" cy="62%" r="55%"><stop offset="0%" stopColor="#f8c9a6" stopOpacity="0.55" /><stop offset="100%" stopColor="#fbf3ea" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="100" height="80" fill="url(#nw-glow)" />
        {/* Cumberland River and the 5-mile match zones; no donor-to-recipient lines. */}
        <motion.path d="M0 52 C 20 40, 35 60, 55 48 S 85 30, 100 42" stroke="#b9cfbd" strokeWidth="3" strokeLinecap="round" fill="none"
          initial={{ pathLength: still ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeOut" }} />
        {[10, 20, 30].map((r, i) => (
          <motion.circle key={r} cx="52" cy="52" r={r} fill="none" stroke="#e8c4a4" strokeDasharray="1 1.5" strokeWidth="0.3"
            initial={{ opacity: 0, scale: still ? 1 : 0.6 }} animate={{ opacity: 1, scale: 1 }} style={{ transformOrigin: "52px 52px" }} transition={{ delay: 0.1 + i * 0.12, duration: 0.6 }} />
        ))}
        {donors.map((name, i) => {
          const d = donorPos(name, i);
          return (
            <g key={name}>
              <rect x={d.x - 1.6} y={d.y - 1.6} width="3.2" height="3.2" rx="0.8" fill="#3d1a0c" />
              <text x={d.x + 2.4} y={d.y + 1} fontSize="2" fill="#3d1a0c">{name}</text>
            </g>
          );
        })}
        {extras.map((p, i) => (
          <motion.g key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.05 }}>
            <title>{`${p.name} · ${extraLabel}`}</title>
            <circle cx={p.x} cy={p.y} r="1.3" fill="#fbf3ea" stroke="#9a3412" strokeWidth="0.45" strokeDasharray="0.9 0.5" />
            <text x={p.x + 1.7} y={p.y + 0.55} fontSize="1.3" fill="#a8a29e">{p.name}</text>
          </motion.g>
        ))}
        {state.recipients.map((r) => (
          <g key={r.id} className="cursor-default [&:hover>circle:last-of-type]:fill-[#bf5320]">
            {/* Static halo — looping pulses read as blinking in user testing */}
            <circle cx={r.x} cy={r.y} r="3" fill="#e07b39" opacity="0.15" />
            <circle cx={r.x} cy={r.y} r="1.8" fill="#e07b39" stroke="white" strokeWidth="0.5" className="transition-colors" />
            {/* Labels near the right edge go on the left of the dot so they aren't clipped. */}
            <text x={r.x > 70 ? r.x - 2.4 : r.x + 2.4} y={r.y + 0.8} textAnchor={r.x > 70 ? "end" : "start"} fontSize="2" fill="#9a3412" fontWeight="600">{r.name}</text>
          </g>
        ))}
      </svg>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-600">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-900" /> Donor institution</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> Recipient org</span>
        {extras.length > 0 && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-brand-700" /> {extraLabel} ({extras.length})</span>}
      </div>
    </Card>
  );
}
