"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Cpu, Inbox, SearchX } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { CATEGORIES } from "@/lib/categories";
import { checkDietary, meetsFilters } from "@/lib/dietary";
import { matchRecipients } from "@/lib/matching";
import type { AssistantDonation } from "@/lib/oci-service";
import type { Batch } from "@/lib/types";
import { btn, EmptyState, GettingStarted, MotionList, PageHeader, Tabs } from "../ui";
import { useSemanticScores } from "../useSemanticScores";
import { AreaNeedPill } from "./AreaNeedPill";
import { AssistantPanel } from "./AssistantPanel";
import { AvailableSummary } from "./AvailableSummary";
import { CapacityEditor } from "./CapacityEditor";
import { DietaryNeeds, DonationFilters, matchesTransport, NO_FILTERS, type Filters } from "./DonationFilters";
import { BroadcastCard } from "./BroadcastCard";
import { MyPickups } from "./MyPickups";
import { RequirementsCard } from "./RequirementsCard";

const GENERIC_REASON = /^(Can take all|Room for|\d.* mi away)/;
const AREA_REASON = /^(Serves a USDA low-income|High-need area)/;

const STEPS = [
  { title: "Browse what's available", body: "Live surplus from nearby donors appears below, best matches for you first." },
  { title: "Narrow it to what you can use", body: "Filter by dietary needs, or write your requirements once and we'll flag any conflicts." },
  { title: "Claim and pick up", body: "Choose a quantity within your capacity (edit it anytime above), then collect before the window closes — or join the waitlist." },
];

export function RecipientPortal() {
  const { state, now } = useNotWasted();
  const org = state.recipients.find((r) => r.id === state.activeRecipientId) ?? state.recipients[0];
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [showAll, setShowAll] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const openPickups = state.claims.filter((c) => c.recipientId === org.id && c.status === "CLAIMED").length;
  const waiting = state.waitlist.filter((w) => w.recipientId === org.id).length;
  const live = state.batches.filter((b) => b.status === "AVAILABLE");
  const semantic = useSemanticScores(live, state.recipients);

  // Rank each live batch for this org; the best fit for us floats to the top.
  const fit = (b: Batch) => {
    const ranked = matchRecipients({ category: b.category, title: b.title, qty: b.remainingQty, attributes: b.attributes }, state.recipients, 5, semantic.scores?.[b.id]);
    const i = ranked.findIndex((m) => m.recipient.id === org.id);
    if (i < 0) return { score: -1, top: false };
    const reasons = ranked[i].reasons;
    return { score: ranked[i].score, top: i === 0, reason: reasons.find((r) => !GENERIC_REASON.test(r) && !AREA_REASON.test(r)), areaReason: reasons.find((r) => AREA_REASON.test(r)) };
  };
  const visible = state.batches.filter((b) => showAll || org.acceptedCategories.includes(b.category));
  const passes = (b: Batch) =>
    (!filters.categories.length || filters.categories.includes(b.category)) &&
    matchesTransport(b.transport, filters.transport) &&
    meetsFilters(b, filters.dietary) &&
    (!filters.fitsRequirements || !checkDietary(b, org.requirements)?.conflicts.length) &&
    (!filters.hideQualityFlags || !b.quality || b.quality.verdict === "Good to donate");
  const batches = visible
    .filter(passes)
    .map((b) => ({ b, ...fit(b) }))
    .sort((x, y) => Number(x.b.status !== "AVAILABLE") - Number(y.b.status !== "AVAILABLE") || y.score - x.score);

  const donations: AssistantDonation[] = live.filter((b) => b.remainingQty > 0 && b.pickupBy > now).map((b) => ({
    id: b.id, title: b.title, category: b.category, remaining: b.remainingQty, unit: CATEGORIES[b.category].unit, institution: b.institution,
    pickupInMinutes: Math.round((b.pickupBy - now) / 60_000), items: b.attributes.items ?? b.attributes.itemTypes ?? b.attributes.garmentTypes ?? [],
    allergens: b.attributes.allergens ?? [], dietary: b.attributes.dietary ?? [], storage: b.attributes.storage,
    quality: b.quality ? `${b.quality.verdict}: ${b.quality.notes}` : undefined,
    dietaryConflicts: checkDietary(b, org.requirements)?.conflicts ?? [], matchScore: Math.max(0, fit(b).score),
  }));

  return (
    <div className="space-y-10 pb-24">
      <PageHeader
        eyebrow="Recipient portal"
        title={org.name}
        accent="Today's rescue."
        description={<>{org.type} · <span className="tabular">{org.distanceMi}</span> mi away · we&apos;ll notify you by {org.notifyChannel.toLowerCase() === "sms" ? "text" : "email"}
          {org.area && <span className="mt-3 flex"><AreaNeedPill area={org.area} /></span>}</>}
        actions={<CapacityEditor org={org} />}
      />

      <GettingStarted id="recipient" title="How claiming works" steps={STEPS} />

      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs id="recipient" size="lg" value={tab} onChange={setTab} items={[
            { value: "available", label: "Available now" },
            { value: "mine", label: <>My pickups
              {openPickups > 0 && <span className="tabular rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">{openPickups}</span>}
              {waiting > 0 && <span title="On waitlist" className="tabular rounded-full bg-brand-100 px-1.5 text-xs font-semibold text-brand-700">{waiting} waiting</span>}
            </> },
          ]} />
          {tab === "available" && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-stone-500">
              <span title={semantic.source === "oci" ? "Need fit ranked with OCI Cohere embeddings" : "Need fit ranked with on-device similarity"} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 ring-1 ring-stone-200/70 backdrop-blur">
                <Cpu className={`h-3.5 w-3.5 ${semantic.source === "oci" ? "text-brand-600" : ""}`} /> Ranked by {semantic.source === "oci" ? "OCI embeddings" : "local semantic match"}
              </span>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 transition hover:bg-brand-50 hover:text-brand-700">
                <input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show categories we don&apos;t accept
              </label>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            {tab === "available" ? (
              <div className="space-y-8">
                <AvailableSummary org={org} />
                <section aria-label="Your needs" className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1 basis-[28rem]"><RequirementsCard key={org.id} org={org} /></div>
                  <DietaryNeeds value={filters} onChange={setFilters} hasRequirements={!!org.requirements?.trim()} />
                </section>
                <DonationFilters value={filters} onChange={setFilters} shown={batches.length} total={visible.length}
                  categories={[...new Set(visible.map((b) => b.category))]} />
                {batches.length ? (
                  <MotionList className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 [&>*]:h-full">
                    {batches.map(({ b, score, top, reason, areaReason }) => <BroadcastCard key={b.id} batch={b} org={org} match={b.status === "AVAILABLE" && score >= 0 ? { score, top, reason, areaReason } : undefined} />)}
                  </MotionList>
                ) : visible.length ? (
                  <EmptyState icon={<SearchX className="h-6 w-6" />} title="No donations match these filters"
                    action={<button className={btn.secondary} onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>}>
                    Try removing a dietary need or category to see more.
                  </EmptyState>
                ) : (
                  <EmptyState icon={<Inbox className="h-6 w-6" />} title="Nothing to claim right now">
                    New surplus shows up here the moment a donor posts it. We&apos;ll also notify you by {org.notifyChannel.toLowerCase() === "sms" ? "text" : "email"}.
                  </EmptyState>
                )}
              </div>
            ) : (
              <MyPickups org={org} onBrowse={() => setTab("available")} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AssistantPanel org={org} donations={donations} />
    </div>
  );
}
