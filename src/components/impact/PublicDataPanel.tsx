"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BadgeCheck, BookOpen, Check, Database, ExternalLink, HandHeart, Loader2, MapPin, RefreshCw, UserPlus } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { AnimatedNumber, Badge, btn, Card, SectionTitle } from "../ui";
import { NetworkMap } from "./NetworkMap";
import { type Attempt, EPA_SOURCE, findOnNetwork, fullAddress, PUBLIC_SOURCES, useEpaDirectory } from "./publicData";

const inView = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { type: "spring" as const, stiffness: 220, damping: 26 },
};

const linkCls = "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 hover:text-brand-900";

function SourceError({ a, what, onRetry, fallback }: { a: Attempt<unknown> | undefined; what: string; onRetry: () => void; fallback?: string | null }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50/80 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">Couldn&apos;t load {what} from <b>{a?.source ?? EPA_SOURCE}</b>{a && !a.ok ? `: ${a.error}` : fallback ? `: ${fallback}` : ""}.</span>
      <button onClick={onRetry} className={`${btn.ghost} min-h-11`}><RefreshCw className="h-4 w-4" /> Retry</button>
    </div>
  );
}

const Skeleton = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded-2xl bg-brand-100/50 ${className}`} />;

const SHORT_LIST = 6;

export function PublicDataPanel() {
  const { state } = useNotWasted();
  const { data, error, loading, retry } = useEpaDirectory();
  const [invites, setInvites] = useState<Record<string, "drafting" | "drafted">>({});
  const [showAll, setShowAll] = useState(false);

  const failed = (a?: Attempt<unknown>) => !!error || (a ? !a.ok : false);
  const totals = data?.totals.ok ? data.totals.data : null;
  const recipients = data?.recipients.ok ? data.recipients.data : [];
  const rows = recipients.map((r) => ({ r, onNet: findOnNetwork(r.name, state.recipients) }))
    .sort((a, b) => Number(!!b.onNet) - Number(!!a.onNet) || a.r.name.localeCompare(b.r.name));
  const offNetwork = rows.filter((x) => !x.onNet).map((x) => x.r);
  const onCount = rows.length - offNetwork.length;
  // Keep the list short by default; the map shows the same organizations as the list.
  const shown = showAll ? rows : rows.slice(0, SHORT_LIST);
  const shownOff = shown.filter((x) => !x.onNet).map((x) => x.r);

  const invite = (id: string) => {
    setInvites((x) => ({ ...x, [id]: "drafting" }));
    setTimeout(() => setInvites((x) => ({ ...x, [id]: "drafted" })), 700);
  };

  return (
    <div className="space-y-6">
      {/* Headline stat */}
      <motion.div {...inView} className="relative overflow-hidden rounded-3xl bg-brand-900 p-7 text-white shadow-lift md:p-9">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-sage-500/25 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-2 text-sm font-medium text-brand-100"><Database className="h-4 w-4" /> Nashville at a glance · {EPA_SOURCE}</div>
        {loading ? (
          <div className="relative mt-5 space-y-3"><div className="h-12 w-3/4 animate-pulse rounded-2xl bg-white/10" /><div className="h-5 w-1/3 animate-pulse rounded-xl bg-white/10" /></div>
        ) : totals ? (
          <>
            <p className="relative mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight md:text-4xl">
              Nashville schools &amp; universities generate an estimated{" "}
              <span className="whitespace-nowrap text-brand-200 tabular"><AnimatedNumber value={totals.tonsLow} />–<AnimatedNumber value={totals.tonsHigh} /></span> tons of excess food a year.
            </p>
            <p className="relative mt-3 text-sm text-white/70">Across <b className="tabular text-white">{totals.institutions.toLocaleString()}</b> EPA-listed educational institutions in Davidson County. Source: EPA estimates (low–high).</p>
          </>
        ) : (
          <div className="relative mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/90">
            Couldn&apos;t load county totals from {data?.totals.source ?? EPA_SOURCE}{data && !data.totals.ok ? `: ${data.totals.error}` : error ? `: ${error}` : ""}.{" "}
            <button onClick={retry} className="min-h-11 font-semibold underline underline-offset-4">Retry</button>
          </div>
        )}
      </motion.div>

      <div>
        {/* Food banks & pantries */}
        <motion.div {...inView}>
          <Card>
            <SectionTitle hint={<>{EPA_SOURCE} · {loading ? "loading…" : <><span className="tabular">{onCount}</span> on Not Wasted, <span className="tabular">{offNetwork.length}</span> not yet</>}</>}>
              <span className="flex items-center gap-2"><HandHeart className="h-5 w-5 text-brand-600" /> Food banks &amp; pantries in Davidson County</span>
            </SectionTitle>
            {loading ? (
              <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : failed(data?.recipients) ? (
              <SourceError a={data?.recipients} what="food banks and pantries" onRetry={retry} fallback={error} />
            ) : (
              <ul className="divide-y divide-brand-100/60">
                {shown.map(({ r, onNet }, i) => {
                  const inv = invites[r.id];
                  return (
                    <motion.li key={r.id} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 8) * 0.03 }}
                      className="-mx-3 flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3 transition duration-300 hover:-translate-y-0.5 hover:bg-brand-50/50">
                      <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                        <div className="flex flex-wrap items-center gap-2 font-medium text-ink">
                          {r.name} <Badge>{r.type}</Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500"><MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{fullAddress(r)}</span></div>
                      </div>
                      <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
                      {r.website && (
                        <a href={r.website} target="_blank" rel="noreferrer" className={linkCls} aria-label={`${r.name} website`}><ExternalLink className="h-4 w-4" /> Website</a>
                      )}
                      {onNet ? (
                        <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-sage-100/80 px-3 text-xs font-medium text-[#2f6b3d] ring-1 ring-sage-500/40" title={`Matched to ${onNet.name}`}>
                          <BadgeCheck className="h-4 w-4" /> On Not Wasted
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="hidden text-xs text-stone-500 sm:inline">Not yet on network</span>
                          <AnimatePresence mode="wait" initial={false}>
                            {inv === "drafted" ? (
                              <motion.span key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
                                <Check className="h-4 w-4" /> Invite drafted
                              </motion.span>
                            ) : (
                              <motion.button key="btn" exit={{ opacity: 0 }} onClick={() => invite(r.id)} disabled={inv === "drafting"} className={`${btn.secondary} min-h-11 !px-4 !py-2`}>
                                {inv === "drafting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invite
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
            {!loading && rows.length > SHORT_LIST && (
              <button type="button" onClick={() => setShowAll(!showAll)} className={`${btn.ghost} mt-3 min-h-11`}>
                {showAll ? "Show fewer" : <>Show all <span className="tabular">{rows.length}</span></>}
              </button>
            )}
          </Card>
        </motion.div>
      </div>

      {offNetwork.length > 0 && (
        <motion.div {...inView} className="mx-auto max-w-3xl">
          <NetworkMap extraPoints={shownOff} />
        </motion.div>
      )}

      <motion.footer {...inView} className="rounded-3xl border border-white/70 bg-white/60 px-6 py-5 text-sm backdrop-blur">
        <div className="mb-3 flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4 text-brand-600" /> Sources</div>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {PUBLIC_SOURCES.map((s) => (
            <li key={s.name} className="flex min-h-11 items-center">
              <a href={s.url} target="_blank" rel="noreferrer" className="group/s flex flex-col leading-snug">
                <span className="inline-flex items-center gap-1 font-medium text-brand-700 group-hover/s:underline">{s.name} <ExternalLink className="h-3 w-3" /></span>
                <span className="text-xs text-stone-500">{s.use}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-stone-500">Invites are drafted in-app only; nothing is sent. Network matches are by organization name.</p>
      </motion.footer>
    </div>
  );
}
