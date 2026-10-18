"use client";

import { motion } from "framer-motion";
import { ArrowRight, Building2, HandHeart } from "lucide-react";
import { SAMPLE_LOGINS } from "@/lib/seed";

export const SAMPLE_ACCOUNTS = [
  { key: "donor" as const, icon: Building2, title: "Sample donor", org: "Vanderbilt University", ...SAMPLE_LOGINS.donor },
  { key: "recipient" as const, icon: HandHeart, title: "Sample recipient", org: "St. Luke's Community Shelter", ...SAMPLE_LOGINS.recipient },
];

/** The two one-click demo accounts, shown on both the sign-in and register screens. */
export function SampleAccounts({ onPick, disabled }: { onPick: (email: string, password: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {SAMPLE_ACCOUNTS.map(({ key, icon: Icon, title, org, email: em, password: pw }) => (
        <motion.button key={key} type="button" whileHover={{ y: -5 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 20 }} disabled={disabled} onClick={() => onPick(em, pw)}
          className="group relative overflow-hidden rounded-3xl border border-white/80 bg-white/80 p-5 text-left shadow-card ring-1 ring-stone-200/80 backdrop-blur transition-[box-shadow,ring-color] duration-300 hover:shadow-[0_18px_40px_-18px_rgb(191_83_32/0.45)] hover:ring-2 hover:ring-brand-500/70 disabled:opacity-60">
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-200/0 blur-2xl transition-colors duration-500 group-hover:bg-brand-200/60" />
          <div className="relative flex items-center justify-between">
            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${key === "donor" ? "bg-amber-100 text-amber-800" : "bg-sage-100 text-sage-700"}`}><Icon className="h-5 w-5" /></span>
            <ArrowRight className="h-4 w-4 text-stone-400 transition duration-300 group-hover:translate-x-1 group-hover:text-brand-600" />
          </div>
          <div className="relative mt-4 text-sm font-semibold text-ink">{title}</div>
          <div className="relative truncate text-xs text-stone-600">{org}</div>
          <div className="relative mt-3 truncate font-mono text-xs text-stone-500">{em}</div>
          <div className="relative font-mono text-xs text-stone-500">{pw}</div>
        </motion.button>
      ))}
    </div>
  );
}
