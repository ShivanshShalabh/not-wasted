"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, ListOrdered, MapPinned, Minus, PackageCheck, Plus, Ruler, ShieldCheck, Sparkles, Truck, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { CATEGORIES, minQty, smallestClaim } from "@/lib/categories";
import { checkDietary } from "@/lib/dietary";
import { countdown } from "@/lib/format";
import { maxClaimable } from "@/lib/inventory";
import type { Batch, RecipientOrg } from "@/lib/types";
import { itemList, Pill, StorageBadge } from "../AttributeTags";
import { AnimatedNumber, Badge, btn, Card, CATEGORY_STYLE, CategoryChip } from "../ui";
import { ClaimEditor } from "./ClaimEditor";

const reveal = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { type: "spring" as const, stiffness: 320, damping: 32 },
};

/** Remaining-stock bar: grows from 0 on mount (scaleX, origin-left) and springs on every claim. */
function StockBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total ? remaining / total : 0;
  const color = remaining === 0 ? "bg-stone-300" : pct > 0.5 ? "bg-gradient-to-r from-brand-500 to-brand-600" : "bg-amber-500";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-100/60">
      <motion.div className={`h-full w-full origin-left rounded-full ${color}`} initial={{ scaleX: 0 }} animate={{ scaleX: pct }} transition={{ type: "spring", stiffness: 110, damping: 20 }} />
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-stone-800">{children}</dd>
    </div>
  );
}

/** Up to three of the most decision-relevant facts; everything else lives behind "Details". */
function keyBadges(batch: Batch): ReactNode[] {
  const a = batch.attributes;
  const out: ReactNode[] = [];
  if (batch.category === "food") {
    if (a.storage) out.push(<StorageBadge key="s" storage={a.storage} />);
    if (a.shelfLifeHours != null) out.push(<Badge key="l"><Clock className="h-3 w-3" /> Within {a.shelfLifeHours}h</Badge>);
  } else {
    if (a.condition) out.push(<Pill key="c">{a.condition}</Pill>);
    if (a.needsTruck) out.push(<Badge key="t" tone="amber"><Truck className="h-3 w-3" /> Truck required</Badge>);
    else if (a.twoPersonLift) out.push(<Badge key="p" tone="amber"><Users className="h-3 w-3" /> 2-person lift</Badge>);
    else if (a.sizeRange) out.push(<Badge key="z">Sizes {a.sizeRange}</Badge>);
  }
  return out.slice(0, 3);
}

export function BroadcastCard({ batch, org, match }: { batch: Batch; org: RecipientOrg; match?: { score: number; top: boolean; reason?: string; areaReason?: string } }) {
  const { state, dispatch, now } = useNotWasted();
  const cfg = CATEGORIES[batch.category];
  const a = batch.attributes;
  const accepts = org.acceptedCategories.includes(batch.category);
  const cap = org.capacity[batch.category] ?? 0;
  const max = maxClaimable(batch, org);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [joining, setJoining] = useState(false);
  // Food pickups start at 5 (or whatever is left, if fewer).
  const least = smallestClaim(batch);
  const [qty, setQty] = useState(Math.max(least, Math.min(25, max)));
  const myOpen = state.claims.find((c) => c.batchId === batch.id && c.recipientId === org.id && c.status === "CLAIMED");
  const pickedUp = state.claims.filter((c) => c.batchId === batch.id && c.recipientId === org.id && c.status === "PICKED_UP").reduce((s, c) => s + c.qty, 0);
  const locked = batch.status === "FULLY_CLAIMED";
  // A waitlist only helps while someone's pickup could still fall through.
  const allPickedUp = locked && !state.claims.some((c) => c.batchId === batch.id && c.status === "CLAIMED");
  const diet = checkDietary(batch, org.requirements);
  const queue = state.waitlist.filter((w) => w.batchId === batch.id).sort((x, y) => x.joinedAt - y.joinedAt);
  const myWait = queue.findIndex((w) => w.recipientId === org.id);
  const waitMin = minQty(batch.category);
  const [waitQty, setWaitQty] = useState(Math.max(waitMin, Math.min(cap, batch.totalQty)));
  const left = batch.pickupBy - now;
  const items = itemList(batch.category, a);

  // Keep the selector inside the live bound when another org claims.
  useEffect(() => setQty((q) => Math.max(least, Math.min(q, max || least))), [max, least]);
  useEffect(() => { if (max === 0) setOpen(false); }, [max]);

  const quick = [
    { label: "25", value: 25 },
    { label: "50", value: 50 },
    { label: `Max ${cap}`, value: cap },
    { label: `All ${batch.remainingQty}`, value: batch.remainingQty },
  ];
  const badges = keyBadges(batch);
  const hasDetails = !!match?.areaReason || items.length > 0 || !!a.allergens?.length || !!a.dietary?.length || !!diet || !!a.dimensions || !!a.notes || !!a.season;
  const Icon = CATEGORY_STYLE[batch.category].icon;
  const q = batch.quality;

  return (
    <Card interactive className={`group flex h-full flex-col ${!accepts ? "opacity-60" : ""}`}>
      {/* Donor's photo, or a category placeholder so cards line up */}
      <div className="-mx-6 -mt-6 mb-5 h-36 overflow-hidden rounded-t-3xl bg-gradient-to-br from-brand-50 via-white to-sage-100">
        {batch.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL from the donor's upload
          <img src={batch.photo} alt={`Photo of ${batch.title}`} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-brand-200" aria-hidden><Icon className="h-12 w-12 transition duration-500 group-hover:scale-110 group-hover:text-brand-500" /></div>
        )}
      </div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CategoryChip category={batch.category} />
          <h3 className="mt-3 line-clamp-2 text-lg font-semibold tracking-tight">{batch.title}</h3>
          <div className="mt-0.5 truncate text-sm text-stone-500">{batch.institution}</div>
        </div>
        {match && (
          <span title={[match.reason, match.areaReason].filter(Boolean).join(" · ") || undefined} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-300 ${match.top ? "bg-brand-600 text-white shadow-[0_6px_14px_-6px_rgb(191_83_32/0.6)] group-hover:bg-brand-700" : "bg-brand-50 text-brand-700 ring-1 ring-brand-100 group-hover:bg-brand-100"}`}>
            <Sparkles className="h-3 w-3 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" /> {match.top ? "Top match" : "Match"} <span className="tabular">{match.score}%</span>
          </span>
        )}
        {locked && <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">All claimed</span>}
      </div>

      {/* Quantity */}
      <div className="mt-6 flex items-end justify-between gap-3">
        <div className={locked ? "text-stone-400" : ""}>
          <span className={`font-display text-4xl font-bold leading-none ${locked ? "" : "text-brand-700"}`}><AnimatedNumber value={batch.remainingQty} /></span>
          <span className="ml-1.5 text-sm text-stone-500"><span className="tabular">of {batch.totalQty}</span> {cfg.unit} left</span>
        </div>
        <span className={`inline-flex items-center gap-1 text-sm ${!locked && left < 30 * 60_000 ? "font-semibold text-red-600" : "text-stone-500"}`}>
          <Clock className="h-3.5 w-3.5" /> <span className="tabular">{left > 0 ? countdown(left) : "Closed"}</span>
        </span>
      </div>
      <div className="mt-3"><StockBar remaining={batch.remainingQty} total={batch.totalQty} /></div>

      {/* Fit + key facts */}
      <div className="mt-5 space-y-3">
        {diet && (
          diet.conflicts.length ? (
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> {diet.conflicts.length} conflict{diet.conflicts.length === 1 ? "" : "s"} with your requirements
            </div>
          ) : (
            <div className="flex w-fit items-center gap-1.5 rounded-full bg-sage-100/80 px-2.5 py-1 text-sm font-medium text-[#2f6b3d] ring-1 ring-sage-500/40"><ShieldCheck className="h-4 w-4 shrink-0" /> Fits your needs</div>
          )
        )}
        {!diet && match?.reason && <div className="flex items-center gap-2 truncate text-sm text-brand-700"><Sparkles className="h-4 w-4 shrink-0" /> {match.reason}</div>}
        {match?.areaReason && (
          <div title="Donor matching gives under-served areas a boost (Census + USDA Food Access Research Atlas)" className="flex w-fit max-w-full items-center gap-1.5 rounded-full bg-brand-50/80 px-2.5 py-1 text-xs font-medium text-brand-800 ring-1 ring-brand-100">
            <MapPinned className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{match.areaReason}</span>
          </div>
        )}
        {badges.length > 0 && <div className="flex flex-wrap gap-1.5">{badges}</div>}
        {q && (
          <p className={`flex gap-2 rounded-2xl px-3 py-2 text-sm leading-snug ring-1 ${q.verdict === "Good to donate" ? "bg-sage-100/60 text-[#2f6b3d] ring-sage-500/30" : q.verdict === "Not suitable" ? "bg-red-50 text-red-800 ring-red-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
            {q.verdict === "Good to donate" ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span><b className="font-semibold">Quality: {q.verdict.toLowerCase()}.</b>{q.notes ? ` ${q.notes}` : ""}</span>
          </p>
        )}
      </div>

      {hasDetails && (
        <div className="mt-4">
          <button onClick={() => setDetails(!details)} aria-expanded={details} className="inline-flex items-center gap-1 rounded-full px-2 py-1 -ml-2 text-sm font-medium text-stone-600 transition hover:bg-brand-50 hover:text-brand-700">
            {details ? "Hide details" : "Details"}
            <motion.span animate={{ rotate: details ? 180 : 0 }} className="inline-flex"><ChevronDown className="h-3.5 w-3.5" /></motion.span>
          </button>
          <AnimatePresence initial={false}>
            {details && (
              <motion.div {...reveal} className="overflow-hidden">
                <dl className="mt-3 space-y-2 rounded-2xl bg-brand-50/40 p-4 ring-1 ring-brand-100/70">
                  {items.length > 0 && <DetailRow label="Includes">{items.join(", ")}</DetailRow>}
                  {a.allergens?.length ? <DetailRow label="Allergens">{a.allergens.join(", ")}</DetailRow> : null}
                  {a.dietary?.length ? <DetailRow label="Dietary">{a.dietary.join(", ")}</DetailRow> : null}
                  {batch.category === "food" && a.storage && <DetailRow label="Storage">{a.storage}{a.shelfLifeHours != null ? ` · pick up within ${a.shelfLifeHours}h` : ""}</DetailRow>}
                  {batch.category !== "food" && a.condition && <DetailRow label="Condition">{a.condition}</DetailRow>}
                  {a.dimensions && <DetailRow label="Size"><span className="inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {a.dimensions}</span></DetailRow>}
                  {a.sizeRange && <DetailRow label="Sizes">{a.sizeRange}</DetailRow>}
                  {a.season && <DetailRow label="Season">{a.season}</DetailRow>}
                  {(a.needsTruck || a.twoPersonLift) && <DetailRow label="Handling">{[a.needsTruck && "Truck required", a.twoPersonLift && "2-person lift"].filter(Boolean).join(" · ")}</DetailRow>}
                  {a.notes && <DetailRow label="Notes">{a.notes}</DetailRow>}
                  {diet && diet.ok.length > 0 && <DetailRow label="Meets"><span className="text-sage-700">{diet.ok.join(", ")}</span></DetailRow>}
                  {diet && diet.conflicts.length > 0 && (
                    <DetailRow label="Conflicts"><ul className="space-y-0.5 text-red-700">{diet.conflicts.map((c) => <li key={c}>{c}</li>)}</ul></DetailRow>
                  )}
                  {match?.areaReason && <DetailRow label="Priority">{match.areaReason} — under-served areas get a matching boost</DetailRow>}
                </dl>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Action area, pinned to the bottom so buttons line up across the grid */}
      <div className="mt-auto pt-6">
        {myOpen ? (
          <ClaimEditor claim={myOpen} batch={batch} org={org} />
        ) : allPickedUp ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-stone-100/70 py-3 text-sm text-stone-600"><PackageCheck className="h-4 w-4" /> All picked up — nothing left to wait for</div>
        ) : locked ? (
          !accepts ? (
            <div className="rounded-2xl bg-stone-100/70 py-3 text-center text-sm text-stone-600">All {batch.totalQty} {cfg.unit} have been claimed</div>
          ) : myWait >= 0 ? (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200">
              <span className="flex items-center gap-2 font-medium"><ListOrdered className="h-4 w-4" /> You&apos;re #<span className="tabular">{myWait + 1}</span> in line · <span className="tabular">{queue[myWait].qty}</span> {cfg.unit}</span>
              <button className="rounded-full px-2 py-0.5 font-semibold text-brand-700 transition hover:bg-brand-100" onClick={() => dispatch({ type: "LEAVE_WAITLIST", entryId: queue[myWait].id })}>Leave</button>
            </motion.div>
          ) : (
            <div>
              <p className="mb-3 text-sm text-stone-500">
                Everything&apos;s been claimed. Join the waitlist and we&apos;ll claim it for you automatically if any frees up{queue.length ? <> · <span className="tabular">{queue.length}</span> ahead of you</> : ""}.
              </p>
              <AnimatePresence initial={false} mode="wait">
                {!joining ? (
                  <motion.button key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`${btn.secondary} w-full`} onClick={() => setJoining(true)}>
                    <ListOrdered className="h-4 w-4" /> Join waitlist
                  </motion.button>
                ) : (
                  <motion.div key="stepper" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <div className="flex items-center rounded-full bg-white ring-1 ring-stone-300">
                      <button aria-label="Fewer" className="p-2.5 text-stone-500 transition hover:text-ink disabled:opacity-30" disabled={waitQty <= waitMin} onClick={() => setWaitQty(Math.max(waitMin, waitQty - 5))}><Minus className="h-4 w-4" /></button>
                      <input type="number" min={waitMin} value={waitQty} aria-label="Waitlist quantity" onChange={(e) => setWaitQty(Math.max(waitMin, Math.floor(+e.target.value) || waitMin))}
                        className="tabular w-14 bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                      <button aria-label="More" className="p-2.5 text-stone-500 transition hover:text-ink" onClick={() => setWaitQty(waitQty + 5)}><Plus className="h-4 w-4" /></button>
                    </div>
                    <button className={btn.ghost} onClick={() => setJoining(false)}>Cancel</button>
                    <button className={`${btn.primary} flex-1`} onClick={() => { dispatch({ type: "JOIN_WAITLIST", batchId: batch.id, recipientId: org.id, qty: waitQty, now: Date.now() }); setJoining(false); }}>
                      Join
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        ) : !accepts ? (
          <div className="rounded-2xl bg-stone-100/70 py-3 text-center text-sm text-stone-600">Your organization doesn&apos;t accept {cfg.label.toLowerCase()}</div>
        ) : cap === 0 ? (
          <div className="rounded-2xl bg-amber-50 py-3 text-center text-sm text-amber-800">Your {cfg.label.toLowerCase()} space is full</div>
        ) : !open ? (
          <button className={`${btn.primary} w-full`} onClick={() => setOpen(true)}>Claim</button>
        ) : null}

        <AnimatePresence initial={false}>
          {open && !locked && !myOpen && max > 0 && (
            <motion.div {...reveal} className="overflow-hidden">
              <div className="space-y-4 rounded-2xl bg-brand-50/50 p-4 ring-1 ring-brand-100">
                <div className="text-sm font-medium">How many {cfg.unit} do you need?{least > 1 && <span className="font-normal text-stone-500"> At least <span className="tabular">{least}</span>.</span>}</div>
                <div className="grid grid-cols-4 gap-2">
                  {quick.map((q) => (
                    <button key={q.label} disabled={q.value < least || q.value > max} onClick={() => setQty(q.value)}
                      className={`tabular whitespace-nowrap rounded-full px-1 py-2 text-sm font-medium ring-1 transition duration-200 hover:-translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0 ${qty === q.value ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-stone-200 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"}`}>
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input type="range" min={least} max={max} value={qty} onChange={(e) => setQty(+e.target.value)} className="flex-1 accent-brand-600" aria-label="Claim quantity" />
                  <input type="number" min={least} max={max} value={qty} onChange={(e) => setQty(Math.max(least, Math.min(max, +e.target.value || least)))}
                    className="tabular w-20 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-right text-sm outline-none focus:border-brand-500" aria-label="Claim quantity (exact)" />
                </div>
                <div className="flex gap-2">
                  <button className={btn.ghost} onClick={() => setOpen(false)}>Cancel</button>
                  <button className={`${btn.primary} flex-1 whitespace-nowrap`} onClick={() => { dispatch({ type: "CLAIM", batchId: batch.id, recipientId: org.id, qty, now: Date.now() }); setOpen(false); }}>
                    Claim <span className="tabular">{qty}</span> {cfg.unit}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {pickedUp > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#2f6b3d]">
            <CheckCircle2 className="h-4 w-4" /> You picked up <span className="tabular">{pickedUp}</span> {cfg.unit}
          </div>
        )}
      </div>
    </Card>
  );
}
