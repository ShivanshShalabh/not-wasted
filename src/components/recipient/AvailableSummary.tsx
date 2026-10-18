"use client";

import { motion } from "framer-motion";
import { Clock, Leaf, Radio } from "lucide-react";
import type { ReactNode } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/categories";
import { checkDietary } from "@/lib/dietary";
import { countdown } from "@/lib/format";
import type { RecipientOrg } from "@/lib/types";
import { AnimatedNumber, CATEGORY_STYLE, fadeUp } from "../ui";

function Stat({ i, icon, label, children, sub, tone = "default" }: { i: number; icon: ReactNode; label: string; children: ReactNode; sub?: ReactNode; tone?: "default" | "urgent" }) {
  return (
    <motion.div variants={fadeUp} custom={i} initial="hidden" animate="show"
      className={`group min-w-0 rounded-3xl border px-6 py-5 shadow-card backdrop-blur-xl transition duration-500 ease-out hover:-translate-y-1 hover:shadow-lift ${tone === "urgent" ? "border-red-200 bg-red-50/80" : "border-white/70 bg-white/85 ring-1 ring-brand-900/[0.04] hover:ring-brand-200"}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-stone-600">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 ${tone === "urgent" ? "bg-red-100" : "bg-brand-50"}`}>{icon}</span>
        {label}
      </div>
      <div className="mt-3">{children}</div>
      {sub && <div className="mt-1 truncate text-sm text-stone-500">{sub}</div>}
    </motion.div>
  );
}

/** At-a-glance totals of every live donation, checked against this org's requirements. */
export function AvailableSummary({ org }: { org: RecipientOrg }) {
  const { state, now } = useNotWasted();
  const live = state.batches.filter((b) => b.status === "AVAILABLE" && b.remainingQty > 0 && b.pickupBy > now);
  const cats = CATEGORY_LIST.map((c) => ({ c, n: live.filter((b) => b.category === c).length })).filter((x) => x.n > 0);
  const food = live.filter((b) => b.category === "food");
  const checks = food.map((b) => checkDietary(b, org.requirements));
  const hasReqs = checks.some(Boolean);
  const fits = checks.filter((d) => !d?.conflicts.length).length;
  const next = [...live].sort((a, b) => a.pickupBy - b.pickupBy)[0];
  const urgent = !!next && next.pickupBy - now < 30 * 60_000;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Stat i={0} icon={<Radio className="h-4 w-4 text-brand-700" />} label="Live donations"
        sub={cats.length ? (
          <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
            {cats.map(({ c, n }) => {
              const Icon = CATEGORY_STYLE[c].icon;
              return <span key={c} className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" /> <span className="tabular">{n}</span> {CATEGORIES[c].label.toLowerCase()}</span>;
            })}
          </span>
        ) : "Nothing live right now"}>
        <span className="font-display text-4xl font-bold text-brand-700"><AnimatedNumber value={live.length} /></span>
      </Stat>

      <Stat i={1} icon={<Leaf className="h-4 w-4 text-sage-700" />} label="Dietary fit"
        sub={!food.length ? "No food donations live" : hasReqs ? "food donations fit your requirements" : "Add requirements to check fit"}>
        {food.length && hasReqs ? (
          <span className="font-display text-4xl font-bold text-brand-700"><AnimatedNumber value={fits} /> <span className="font-sans text-base font-normal text-stone-500">of {food.length}</span></span>
        ) : (
          <span className="font-display text-4xl font-bold text-stone-400">{food.length || "—"}</span>
        )}
      </Stat>

      <Stat i={2} tone={urgent ? "urgent" : "default"} icon={<Clock className={`h-4 w-4 ${urgent ? "text-red-600" : "text-brand-700"}`} />} label="Next deadline"
        sub={next ? `${next.title} · ${next.institution}` : "Nothing pending"}>
        <span className={`font-display text-4xl font-bold ${urgent ? "text-red-700" : next ? "text-brand-700" : "text-stone-400"}`}>{next ? countdown(next.pickupBy - now) : "—"}</span>
      </Stat>
    </div>
  );
}
