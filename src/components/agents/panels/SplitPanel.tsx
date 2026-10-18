"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Hourglass, Loader2, MessageSquare, PackagePlus, Play, Split, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { oversizedBatches, type Allocation } from "@/lib/agents/split";
import type { AgentStep } from "@/lib/agents/trace";
import { currentAccount } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { newId, reducer, type Action } from "@/lib/inventory";
import type { Batch } from "@/lib/types";
import { Pill } from "../../AttributeTags";
import { Badge, btn, Card, CategoryChip, EmptyState, segmentColor } from "../../ui";
import { AgentTrace } from "../AgentTrace";
import { useAgent } from "../useAgent";

interface SplitResponse {
  steps: AgentStep[];
  allocations: Allocation[];
  unallocated: number;
  batch: { id: string; title: string; remainingQty: number; unit: string };
  requests: { recipientId: string; channel: string; text: string }[];
  error?: string;
}

type Status = { phase: "awaiting" } | { phase: "confirming" } | { phase: "confirmed" } | { phase: "failed"; error: string };

export function SplitPanel() {
  const { state, dispatch } = useNotWasted();
  const me = currentAccount(state);
  const agent = useAgent<SplitResponse>("/api/agents/split");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [runQueued, setRunQueued] = useState<string | null>(null);
  const latest = useRef(state);
  latest.current = state;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const oversized = useMemo(() => oversizedBatches(state), [state]);
  const others = useMemo(() => state.batches.filter((b) => b.status === "AVAILABLE" && !oversized.some((o) => o.id === b.id)), [state.batches, oversized]);

  // A freshly posted demo batch must be in state before useAgent posts it to the endpoint.
  useEffect(() => {
    if (!runQueued || !state.batches.some((b) => b.id === runQueued)) return;
    const id = runQueued;
    setRunQueued(null);
    propose(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runQueued, state.batches]);

  function propose(batchId: string) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSelected(batchId);
    setStatus({});
    agent.run({ batchId });
  }

  function postDemo() {
    const postedAt = Date.now();
    const batch: Batch = {
      id: newId("bat"), category: "food", title: "Boxed lunches (conference overflow)",
      institution: me?.orgName ?? "Vanderbilt University", department: "Conference center", address: me?.address ?? "2301 Vanderbilt Pl, Nashville, TN",
      totalQty: 300, remainingQty: 300, status: "AVAILABLE",
      attributes: { storage: "Refrigerated", items: ["Turkey wraps", "Veggie wraps", "Fruit cups"], allergens: ["Gluten", "Dairy"] },
      transport: "Recipient picks up", postedAt, pickupBy: postedAt + 3 * 3600_000, aiSource: "local",
    };
    dispatch({ type: "BROADCAST", batch });
    setSelected(batch.id);
    setRunQueued(batch.id);
  }

  /** Claims one allocation. Predicts the reducer result so the row can show the exact error. */
  function confirm(a: Allocation) {
    const batchId = agent.data?.batch.id;
    if (!batchId) return;
    const action: Action = { type: "CLAIM", batchId, recipientId: a.recipientId, qty: a.qty, now: Date.now() };
    const next = reducer(latest.current, action);
    dispatch(action);
    latest.current = next;
    setStatus((s) => ({ ...s, [a.recipientId]: next.lastError ? { phase: "failed", error: next.lastError } : { phase: "confirmed" } }));
  }

  const pending = (agent.data?.allocations ?? []).filter((a) => (status[a.recipientId]?.phase ?? "awaiting") === "awaiting");

  function confirmAll() {
    pending.forEach((a, i) => timers.current.push(setTimeout(() => confirm(a), i * 120)));
  }

  function simulateReplies() {
    pending.forEach((a, i) => {
      timers.current.push(setTimeout(() => setStatus((s) => ({ ...s, [a.recipientId]: { phase: "confirming" } })), 300 + i * 900));
      timers.current.push(setTimeout(() => confirm(a), 1100 + i * 900));
    });
  }

  const data = agent.done ? agent.data : null;
  const confirmedQty = data?.allocations.filter((a) => status[a.recipientId]?.phase === "confirmed").reduce((n, a) => n + a.qty, 0) ?? 0;
  const allSettled = !!data && data.allocations.length > 0 && data.allocations.every((a) => ["confirmed", "failed"].includes(status[a.recipientId]?.phase ?? ""));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="min-w-0 space-y-6">
        <Card className="space-y-4">
          <p className="text-sm leading-relaxed text-stone-600">
            Some donations are bigger than any one food bank can store. The agent ranks nearby orgs, fills each up to its free capacity, and drafts a reservation request. Claims are made only when you confirm each reply.
          </p>
          <BatchList title="Too big for any one food bank" batches={oversized} selected={selected} onPick={propose} disabled={agent.loading} highlight />
          <BatchList title="Other available donations" batches={others} selected={selected} onPick={propose} disabled={agent.loading} />
          {!oversized.length && !others.length && <p className="text-sm text-stone-500">No available donations right now.</p>}
          <button onClick={postDemo} disabled={agent.loading} className={`${btn.ghost} min-h-11`}><PackagePlus className="h-4 w-4" /> Post a 300-meal test donation</button>
          <AnimatePresence>
            {agent.error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {agent.error}
              </motion.p>
            )}
          </AnimatePresence>
        </Card>
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">What the agent did</h3>
          <AgentTrace steps={agent.steps} running={agent.loading} idle="Pick a donation to see how the agent splits it." />
        </Card>
      </div>

      <div className="min-w-0 space-y-4">
        {agent.loading && <SplitSkeleton />}
        {!agent.loading && !agent.data && (
          <EmptyState icon={<Split className="h-6 w-6" />} title="No split proposed yet"
            action={<button onClick={postDemo} className={`${btn.secondary} min-h-11`}><PackagePlus className="h-4 w-4" /> Post a 300-meal test donation</button>}>
            Pick a donation on the left, or post a big test donation to watch it get divided.
          </EmptyState>
        )}
        {data && (
          <>
            <Card className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Proposed split</div>
                  <div className="mt-1 font-semibold text-ink">{data.batch.title}</div>
                  <div className="text-sm text-stone-600"><span className="tabular">{data.batch.remainingQty}</span> {data.batch.unit} across <span className="tabular">{data.allocations.length}</span> org{data.allocations.length === 1 ? "" : "s"}</div>
                </div>
                {data.unallocated > 0 ? <Badge tone="amber"><span className="tabular">{data.unallocated}</span> unplaced</Badge> : <Badge tone="green">Fully placed</Badge>}
              </div>
              <StackedBar allocations={data.allocations} unallocated={data.unallocated} total={data.batch.remainingQty} status={status} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                {data.allocations.map((a, i) => (
                  <span key={a.recipientId} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${segmentColor(i)}`} /> {a.name} <span className="tabular text-stone-400">{a.qty}</span></span>
                ))}
                {data.unallocated > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-stone-300" /> Unplaced <span className="tabular text-stone-400">{data.unallocated}</span></span>}
              </div>
              {data.allocations.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-4">
                  <button onClick={confirmAll} disabled={!pending.length} className={`${btn.primary} min-h-11`}><CheckCircle2 className="h-4 w-4" /> Confirm all</button>
                  <button onClick={simulateReplies} disabled={!pending.length} className={`${btn.secondary} min-h-11`}><Zap className="h-4 w-4" /> Simulate replies</button>
                  <span className="text-xs text-stone-500 tabular">{confirmedQty} of {data.batch.remainingQty} {data.batch.unit} claimed</span>
                </div>
              )}
              <AnimatePresence>
                {allSettled && (
                  <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="status" className="flex items-center gap-2 rounded-2xl bg-sage-100/70 px-3 py-2 text-sm font-medium text-[#2f6b3d] ring-1 ring-sage-500/40">
                    <CheckCircle2 className="h-4 w-4" /> Split complete — <span className="tabular">{confirmedQty}</span> {data.batch.unit} reserved.
                  </motion.p>
                )}
              </AnimatePresence>
            </Card>

            {data.allocations.length === 0 && (
              <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No org has room">Nobody nearby has free capacity for this category right now.</EmptyState>
            )}
            {data.allocations.map((a, i) => (
              <motion.div key={a.recipientId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, type: "spring", stiffness: 260, damping: 26 }}>
                <AllocationRow a={a} i={i} unit={data.batch.unit} request={data.requests.find((r) => r.recipientId === a.recipientId)?.text} status={status[a.recipientId] ?? { phase: "awaiting" }} onConfirm={() => confirm(a)} />
              </motion.div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function BatchList({ title, batches, selected, onPick, disabled, highlight }: { title: string; batches: Batch[]; selected: string | null; onPick: (id: string) => void; disabled: boolean; highlight?: boolean }) {
  if (!batches.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{title} {highlight && <Badge tone="amber"><span className="tabular">{batches.length}</span></Badge>}</div>
      <div className="space-y-2">
        {batches.map((b, i) => {
          const on = selected === b.id;
          return (
            <motion.button key={b.id} onClick={() => onPick(b.id)} disabled={disabled} aria-pressed={on}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={`group flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:-translate-y-0.5 disabled:cursor-wait ${on ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white/70 ring-1 ring-stone-200 hover:ring-brand-200"}`}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{b.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                  <CategoryChip category={b.category} /> <span><span className="tabular">{b.remainingQty}</span> {CATEGORIES[b.category].unit} · {b.institution}</span>
                </span>
              </span>
              <Play className={`h-4 w-4 shrink-0 transition ${on ? "text-brand-600" : "text-stone-300 group-hover:text-brand-500"}`} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function StackedBar({ allocations, unallocated, total, status }: { allocations: Allocation[]; unallocated: number; total: number; status: Record<string, Status> }) {
  const segs = [...allocations.map((a, i) => ({ key: a.recipientId, label: a.name, qty: a.qty, cls: segmentColor(i), done: status[a.recipientId]?.phase === "confirmed" })), ...(unallocated > 0 ? [{ key: "rest", label: "Unplaced", qty: unallocated, cls: "bg-stone-300", done: false }] : [])];
  return (
    <div className="flex h-6 w-full overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200" role="img" aria-label={segs.map((s) => `${s.label} ${s.qty}`).join(", ")}>
      {segs.map((s, i) => (
        <motion.div key={s.key} title={`${s.label}: ${s.qty}`} initial={{ width: 0 }} animate={{ width: `${total ? (s.qty / total) * 100 : 0}%` }}
          transition={{ type: "spring", stiffness: 110, damping: 20, delay: 0.1 + i * 0.12 }}
          className={`relative flex h-full items-center justify-center border-r-2 border-white/80 text-[11px] font-semibold text-white last:border-r-0 ${s.cls}`}>
          {s.done && <CheckCircle2 className="h-3.5 w-3.5 drop-shadow" />}
        </motion.div>
      ))}
    </div>
  );
}

function AllocationRow({ a, i, unit, request, status, onConfirm }: { a: Allocation; i: number; unit: string; request?: string; status: Status; onConfirm: () => void }) {
  return (
    <Card interactive className="space-y-3 !p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${segmentColor(i)}`} />
          <div className="min-w-0">
            <div className="font-semibold text-ink">{a.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
              <Pill tone="brand"><span className="tabular">{a.score}%</span> match</Pill> {a.reason} · via {a.channel}
            </div>
          </div>
        </div>
        <div className="text-right"><div className="font-display text-2xl font-semibold tabular text-ink">{a.qty}</div><div className="text-xs text-stone-500">{unit}</div></div>
      </div>
      {request && (
        <p className="flex gap-2 rounded-2xl bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-600 ring-1 ring-stone-100">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" /> {request}
        </p>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {status.phase === "awaiting" && (
          <motion.div key="await" exit={{ opacity: 0 }} className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="amber"><Hourglass className="h-3 w-3" /> Awaiting reply</Badge>
            <button onClick={onConfirm} className={`${btn.secondary} min-h-11`}><CheckCircle2 className="h-4 w-4" /> Mark confirmed</button>
          </motion.div>
        )}
        {status.phase === "confirming" && (
          <motion.div key="conf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> {a.name} replied YES — claiming…</motion.div>
        )}
        {status.phase === "confirmed" && (
          <motion.div key="ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="status" className="flex items-center gap-2 text-sm font-medium text-[#2f6b3d]"><CheckCircle2 className="h-4 w-4" /> Confirmed · <span className="tabular">{a.qty}</span> {unit} claimed</motion.div>
        )}
        {status.phase === "failed" && (
          <motion.div key="err" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {status.error}</motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function SplitSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="animate-pulse rounded-3xl bg-white/70 p-6 ring-1 ring-brand-900/[0.04]">
        <div className="h-3 w-24 rounded-full bg-stone-200" />
        <div className="mt-3 h-4 w-1/2 rounded-full bg-stone-200" />
        <div className="mt-5 h-6 rounded-full bg-stone-100" />
      </div>
      {[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white/60 ring-1 ring-brand-900/[0.04]" />)}
    </div>
  );
}
