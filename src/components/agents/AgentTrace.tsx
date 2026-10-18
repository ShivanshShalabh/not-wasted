"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Database, Loader2 } from "lucide-react";
import type { AgentStep } from "@/lib/agents/trace";

/** "What the agent did" timeline shared by every agent panel. */
export function AgentTrace({ steps, running, idle = "Run the agent to see each step here." }: { steps: AgentStep[]; running: boolean; idle?: string }) {
  if (!steps.length && !running) return <p className="rounded-3xl border border-dashed border-brand-200 bg-white/50 px-5 py-8 text-center text-sm text-stone-500">{idle}</p>;
  return (
    <ol className="space-y-4" aria-live="polite">
      <AnimatePresence initial={false}>
        {steps.map((s, i) => (
          <motion.li key={`${i}-${s.title}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"><Check className="h-3.5 w-3.5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{s.title}</span>
                {s.source && <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-medium text-[#2f6b3d]"><Database className="h-3 w-3" /> {s.source}</span>}
              </div>
              {s.detail.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-stone-600">
                  {s.detail.slice(0, 5).map((d, j) => <li key={j}>{d}</li>)}
                  {s.detail.length > 5 && <li className="text-stone-400">and {s.detail.length - 5} more</li>}
                </ul>
              )}
            </div>
          </motion.li>
        ))}
        {running && (
          <motion.li key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 text-sm text-stone-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Loader2 className="h-3.5 w-3.5 animate-spin" /></span> Working…
          </motion.li>
        )}
      </AnimatePresence>
    </ol>
  );
}
