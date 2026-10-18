"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useNotWasted } from "@/context/NotWastedContext";
import { matchRecipients, type MatchInput } from "@/lib/matching";

/** Ranked recipient matches for a donation, with reasons. */
export function MatchList({ input, limit = 3, title = "Best matches" }: { input: MatchInput; limit?: number; title?: string }) {
  const { state } = useNotWasted();
  const matches = matchRecipients(input, state.recipients).slice(0, limit);

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink"><Sparkles className="h-4 w-4 text-brand-600" /> {title}</div>
      {matches.length === 0 ? (
        <p className="text-sm text-stone-400">No nearby recipient accepts this yet.</p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m, i) => (
            <motion.li key={m.recipient.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07, type: "spring", stiffness: 260, damping: 24 }} whileHover={{ x: 3 }} className="group flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 ring-1 ring-stone-200/80 transition-[box-shadow,background-color] duration-300 hover:bg-white hover:shadow-card hover:ring-brand-200">
              <span className="transition-transform duration-300 group-hover:scale-105"><ScoreRing score={m.score} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{m.recipient.name}{i === 0 && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100">Top match</span>}</div>
                <div className="mt-0.5 truncate text-xs text-stone-500">{m.reasons.join(" · ")}</div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "#bf5320" : score >= 50 ? "#e07b39" : "#a8a29e";
  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#f3e6da" strokeWidth="3" />
        <motion.circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 0.8, ease: "easeOut" }} />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-xs font-bold">{score}</span>
    </div>
  );
}
