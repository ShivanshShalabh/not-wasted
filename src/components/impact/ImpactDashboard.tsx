"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, DollarSign, Handshake, MapPinned, Package, Scale, Timer, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { currentAccount } from "@/lib/auth";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/categories";
import { computeImpact } from "@/lib/impact";
import type { Category } from "@/lib/types";
import { AnimatedNumber, Card, CATEGORY_STYLE, fadeUp, PageHeader, SectionTitle, Tabs } from "../ui";
import { ImpactSummary } from "./ImpactSummary";
import { NetworkMap } from "./NetworkMap";
import { PublicDataPanel } from "./PublicDataPanel";
import { RecipientDirectory } from "./RecipientDirectory";
import { TaxBreakdown } from "./TaxBreakdown";

type Tab = "overview" | "report" | "directory" | "public";

/** Warm, theme-matched fills for the category bars (category chips keep their own palette). */
const BAR: Record<Category, string> = {
  food: "bg-gradient-to-r from-brand-500 to-brand-600",
  furniture: "bg-gradient-to-r from-[#d9a066] to-[#c0843f]",
  clothing: "bg-gradient-to-r from-sage-500 to-sage-700",
  other: "bg-gradient-to-r from-brand-200 to-[#c98b6b]",
};

const inView = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { type: "spring" as const, stiffness: 200, damping: 26 },
};

export function ImpactDashboard() {
  const { state, now } = useNotWasted();
  const [tab, setTab] = useState<Tab>("overview");
  const stats = computeImpact(state, now);
  const me = currentAccount(state);
  const isRecipient = me?.role === "recipient";
  // Headline numbers are the signed-in organization's own impact; the rest of the page is network-wide.
  const mine = computeImpact(state, now, isRecipient ? { recipientId: me?.recipientId } : { donor: me?.orgName });
  const [taxOpen, setTaxOpen] = useState(false);
  const hero = [
    { label: isRecipient ? "Items received" : "Items rescued", value: mine.totalItems, icon: Package, note: isRecipient ? "claimed by your organization" : "of your donations claimed by recipients" },
    { label: isRecipient ? "Pounds kept out of landfill" : "Pounds diverted from landfill", value: mine.lbs, icon: Scale, note: <><span className="tabular"><AnimatedNumber value={mine.co2eKg} from={0} duration={1.6} /></span> kg CO2e saved</> },
    // Tax figures matter to donors only.
    isRecipient
      ? { label: "Handoffs completed", value: mine.pickedUp, icon: Handshake, note: "pickups you confirmed" }
      : { label: "Estimated tax deduction", value: mine.deduction, icon: DollarSign, prefix: "$", note: "Tap to see how it's calculated", onClick: () => setTaxOpen(true) },
  ];
  const minor = [
    { label: "Average minutes to claim", value: stats.avgTimeToClaim, icon: Timer },
    { label: "Handoffs completed", value: stats.pickedUp, icon: Handshake },
    { label: "Missed pickups", value: stats.fellThrough, icon: TriangleAlert },
  ];
  const max = Math.max(1, ...Object.values(stats.byCategory));
  const totalCat = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
  const top = [...CATEGORY_LIST].sort((a, b) => stats.byCategory[b] - stats.byCategory[a])[0];

  return (
    <div className="space-y-10">
      <PageHeader title="Network" accent="impact"
        description={<>Your organization&apos;s impact first, then what the whole Nashville network has rescued — updated live as donations are claimed.</>} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-stone-600">Your impact{me ? <> · <span className="text-ink">{me.orgName}</span></> : null}</h2>
        {/* One floating stats card, like the reference hero's: white glass, terracotta Playfair numbers. */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.1 }}
          className="relative grid overflow-hidden rounded-3xl border border-white/80 bg-white/90 shadow-lift ring-1 ring-brand-900/[0.04] backdrop-blur-xl md:grid-cols-3">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-200/40 blur-3xl" />
          {hero.map(({ label, value, icon: Icon, prefix, note, onClick }, i) => {
            const body = (
              <>
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-transform duration-500 ease-out group-hover:-rotate-6 group-hover:scale-110"><Icon className="h-5 w-5" /></span>
                <div className="mt-4 font-display text-5xl font-bold tracking-tight text-brand-700 md:text-6xl">{prefix}<AnimatedNumber value={value} from={0} duration={1.6} /></div>
                <div className="mt-2 text-sm font-medium text-ink">{label}</div>
                <div className={`mt-1 inline-flex items-center gap-1 text-sm ${onClick ? "font-medium text-brand-700" : "text-stone-500"}`}>{note}{onClick && <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />}</div>
              </>
            );
            const cls = "group relative block w-full px-7 py-7 text-center transition-colors duration-500 hover:bg-brand-50/50 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:border-brand-100 max-md:[&:not(:first-child)]:border-t max-md:[&:not(:first-child)]:border-brand-100";
            return (
              <motion.div key={label} variants={fadeUp} custom={i + 1} initial="hidden" animate="show" className={cls}>
                {onClick ? <button type="button" onClick={onClick} aria-haspopup="dialog" className="w-full cursor-pointer rounded-2xl">{body}</button> : body}
              </motion.div>
            );
          })}
        </motion.div>
        <h2 className="pt-4 text-sm font-semibold text-stone-600">Across the network</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {minor.map(({ label, value, icon: Icon }, i) => (
            <motion.div key={label} variants={fadeUp} custom={i + 4} initial="hidden" animate="show"
              className="group flex items-center gap-4 rounded-3xl border border-white/70 bg-white/80 px-5 py-4 shadow-card backdrop-blur-xl transition duration-500 ease-out hover:-translate-y-1 hover:shadow-lift">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 ${Icon === TriangleAlert && value > 0 ? "bg-red-50 text-red-700" : Icon === Handshake ? "bg-sage-100 text-sage-700" : "bg-brand-50 text-brand-700"}`}><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1 text-sm text-stone-600">{label}</div>
              <div className="font-display text-3xl font-bold text-brand-700"><AnimatedNumber value={value} /></div>
            </motion.div>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-stone-500">Pounds, CO2e and dollar value are app-level per-category estimates (average weight, emissions factor and fair-market value per unit), not figures from a public dataset. See Nashville at a glance for sourced public data.</p>
      </section>

      <motion.section {...inView} className="space-y-6">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Tabs id="impact" value={tab} onChange={setTab} items={[
          { value: "overview", label: "Overview" },
          { value: "report", label: "Impact report" },
          { value: "directory", label: "Directory" },
          { value: "public", label: <><MapPinned className="h-3.5 w-3.5" /> Nashville at a glance</> },
        ]} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            {tab === "overview" && (
              <div className="grid items-start gap-6 lg:grid-cols-5">
                <Card className="lg:col-span-2">
                  <SectionTitle hint="Units claimed, by type of donation">Rescued by category</SectionTitle>
                  <div className="space-y-5">
                    {CATEGORY_LIST.map((c, i) => {
                      const Icon = CATEGORY_STYLE[c].icon;
                      const share = totalCat ? Math.round((stats.byCategory[c] / totalCat) * 100) : 0;
                      return (
                        <div key={c}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-brand-600" /> {CATEGORIES[c].label}</span>
                            <span className="text-stone-500"><b className="font-semibold text-ink tabular"><AnimatedNumber value={stats.byCategory[c]} /></b> {CATEGORIES[c].unit} <span className="ml-1 tabular text-stone-500">{share}%</span></span>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-100/50">
                            <motion.div className={`h-full w-full origin-left rounded-full ${BAR[c]}`} initial={{ scaleX: 0 }} animate={{ scaleX: stats.byCategory[c] / max }} transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.15 + i * 0.06 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-stone-100 pt-5 text-sm">
                    <div>
                      <dt className="text-stone-500">Live donations</dt>
                      <dd className="mt-0.5 font-display text-3xl font-bold text-brand-700"><AnimatedNumber value={stats.activeBatches} /></dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Pickups on the way</dt>
                      <dd className="mt-0.5 font-display text-3xl font-bold text-brand-700"><AnimatedNumber value={stats.openClaims} /></dd>
                    </div>
                  </dl>
                  {totalCat > 0 && (
                    <p className="mt-5 rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900 ring-1 ring-brand-100">
                      {CATEGORIES[top].label} leads with <b className="tabular">{Math.round((stats.byCategory[top] / totalCat) * 100)}%</b> of everything rescued.
                    </p>
                  )}
                </Card>
                <div className="lg:col-span-3"><NetworkMap /></div>
              </div>
            )}
            {tab === "report" && <ImpactSummary stats={stats} />}
            {tab === "directory" && <RecipientDirectory />}
            {tab === "public" && <PublicDataPanel />}
          </motion.div>
        </AnimatePresence>
      </motion.section>
      {!isRecipient && me && <TaxBreakdown donor={me.orgName} open={taxOpen} onClose={() => setTaxOpen(false)} />}
    </div>
  );
}
