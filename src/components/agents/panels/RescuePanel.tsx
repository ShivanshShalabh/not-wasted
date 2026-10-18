"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, Loader2, MessageSquare, Radar, RotateCcw, Send, ShieldCheck, Timer, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import type { RescueCase } from "@/lib/agents/rescue";
import type { AgentStep } from "@/lib/agents/trace";
import { CATEGORIES } from "@/lib/categories";
import { Pill } from "../../AttributeTags";
import { AiSourceBadge, Badge, btn, Card, EmptyState } from "../../ui";
import { AgentTrace } from "../AgentTrace";
import { useAgent } from "../useAgent";

interface RescueMessage { claimId: string; to: string; text: string; source: "oci" | "local" }
interface RescueResponse { steps: AgentStep[]; cases: RescueCase[]; messages: RescueMessage[]; error?: string }

type Outcome = { phase: "sending" | "sent"; summary: string; to: string };

const PLAN_LABEL: Record<RescueCase["plan"], { label: string; tone: "green" | "amber" | "red" }> = {
  waitlist: { label: "Waitlist", tone: "green" },
  rematch: { label: "Re-match", tone: "amber" },
  none: { label: "No taker", tone: "red" },
};

export function RescuePanel() {
  const { state, dispatch, now } = useNotWasted();
  const agent = useAgent<RescueResponse>("/api/agents/rescue");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [rescanQueued, setRescanQueued] = useState(false);

  // useAgent posts the state from the render it was called in, so re-scan after the dispatch lands.
  useEffect(() => {
    if (!rescanQueued) return;
    setRescanQueued(false);
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescanQueued, state]);

  function scan() {
    setOutcomes({});
    setTexts({});
    agent.run();
  }

  function simulateLate() {
    dispatch({ type: "DEMO_LATE_PICKUP", now: Date.now(), minutesLeft: 12 });
    setRescanQueued(true);
  }

  function approve(c: RescueCase, msg: RescueMessage | undefined) {
    const to = msg?.to ?? (c.plan === "waitlist" ? c.waitlistNext?.name : c.rematch[0]?.name) ?? "the donor";
    dispatch({ type: "CANCEL_CLAIM", claimId: c.claim.id, now: Date.now() });
    const unit = CATEGORIES[c.batch.category].unit;
    const summary = c.plan === "waitlist"
      ? `Rescued: offered to ${c.waitlistNext!.name} (${c.waitlistNext!.qty} ${unit} auto-claimed from the waitlist)`
      : c.plan === "rematch"
        ? `Quantity returned to the batch; urgent text sent to ${to}`
        : "Quantity returned to the batch; the donor has been alerted";
    setOutcomes((o) => ({ ...o, [c.claim.id]: { phase: "sending", summary, to } }));
    setTimeout(() => setOutcomes((o) => (o[c.claim.id] ? { ...o, [c.claim.id]: { ...o[c.claim.id], phase: "sent" } } : o)), 1000);
  }

  const data = agent.data;
  const cases = agent.done ? data?.cases ?? [] : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-6">
        <Card>
          <p className="text-sm leading-relaxed text-stone-600">
            Watches every open pickup. When one is within 30 minutes of its window (or already late), it picks a rescue plan — hand the food to the next waitlisted org, or re-match it to the best nearby food bank — and drafts an urgent text. Nothing is cancelled or sent until you approve.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={scan} disabled={agent.loading} className={`${btn.primary} min-h-11`}>
              {agent.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />} Scan for at-risk pickups
            </button>
            <button onClick={simulateLate} disabled={agent.loading} className={`${btn.ghost} min-h-11`}>
              <Timer className="h-4 w-4" /> Simulate a late pickup
            </button>
          </div>
          <AnimatePresence>
            {agent.error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {agent.error}
              </motion.p>
            )}
          </AnimatePresence>
        </Card>
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">What the agent did</h3>
          <AgentTrace steps={agent.steps} running={agent.loading} idle="Scan to check every open pickup against its window." />
        </Card>
      </div>

      <div className="min-w-0 space-y-4">
        {agent.loading && !agent.done && <Skeletons />}
        {!agent.loading && !data && (
          <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="No scan yet" action={<button onClick={scan} className={`${btn.secondary} min-h-11`}><Radar className="h-4 w-4" /> Scan now</button>}>
            Run a scan to see pickups that might miss their window.
          </EmptyState>
        )}
        {agent.done && cases.length === 0 && (
          <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="All pickups on track"
            action={<button onClick={simulateLate} className={`${btn.secondary} min-h-11`}><Timer className="h-4 w-4" /> Simulate a late pickup</button>}>
            No open pickup is within 30 minutes of its window. Simulate one to see how a rescue works.
          </EmptyState>
        )}
        <AnimatePresence>
          {cases.map((c, i) => {
            const msg = data?.messages.find((m) => m.claimId === c.claim.id);
            return (
              <motion.div key={c.claim.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.08, type: "spring", stiffness: 260, damping: 26 }}>
                <CaseCard c={c} msg={msg} now={now} text={texts[c.claim.id] ?? msg?.text ?? ""} onText={(t) => setTexts((x) => ({ ...x, [c.claim.id]: t }))}
                  outcome={outcomes[c.claim.id]} stillOpen={state.claims.some((x) => x.id === c.claim.id && x.status === "CLAIMED")} onApprove={() => approve(c, msg)} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CaseCard({ c, msg, now, text, onText, outcome, stillOpen, onApprove }: {
  c: RescueCase; msg?: RescueMessage; now: number; text: string; onText: (t: string) => void; outcome?: Outcome; stillOpen: boolean; onApprove: () => void;
}) {
  const unit = CATEGORIES[c.batch.category].unit;
  const mins = Math.round((c.claim.pickupBy - now) / 60_000);
  const overdue = mins < 0;
  const plan = PLAN_LABEL[c.plan];
  return (
    <Card interactive className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-ink">{c.recipient.name}</div>
          <div className="text-sm text-stone-600">
            <span className="tabular">{c.claim.qty}</span> {unit} of {c.batch.title} · {c.batch.institution}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={overdue ? "red" : "amber"}><Clock className="h-3 w-3" /> <span className="tabular">{overdue ? `${-mins} min overdue` : `${mins} min left`}</span></Badge>
          <Badge tone={plan.tone}>{plan.label}</Badge>
        </div>
      </div>

      {c.plan === "waitlist" && c.waitlistNext && (
        <div className="flex items-center gap-3 rounded-2xl bg-sage-100/60 px-4 py-3 text-sm">
          <Users className="h-4 w-4 text-sage-700" />
          <span><b className="text-ink">{c.waitlistNext.name}</b> is next on the waitlist for <span className="tabular">{c.waitlistNext.qty}</span> {unit}.</span>
        </div>
      )}
      {c.plan !== "waitlist" && c.rematch.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Best re-matches</div>
          <ol className="space-y-2">
            {c.rematch.map((r, i) => (
              <li key={r.recipientId} className="flex items-start gap-3 rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-stone-100">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 tabular">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-ink">{r.name}</span>
                    <Pill tone="brand"><span className="tabular">{r.score}%</span> match</Pill>
                    <span className="text-xs text-stone-500">via {r.channel}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">{r.reasons.slice(0, 3).join(" · ")}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {c.plan === "none" && <p className="text-sm text-stone-600">No org nearby can take this. Approving returns the quantity to the batch so the donor can re-post it.</p>}

      {msg && (
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={`msg-${c.claim.id}`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500"><MessageSquare className="h-3.5 w-3.5" /> Urgent text to {msg.to}</label>
            <AiSourceBadge source={msg.source} />
          </div>
          <textarea id={`msg-${c.claim.id}`} value={text} onChange={(e) => onText(e.target.value)} rows={3} disabled={!!outcome}
            className="w-full resize-y rounded-2xl border border-stone-200 bg-white/90 px-4 py-2.5 text-sm leading-relaxed outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-stone-50 disabled:text-stone-500" />
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {outcome ? (
          <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 rounded-2xl bg-sage-100/70 px-4 py-3 text-sm text-[#2f6b3d] ring-1 ring-sage-500/40" role="status">
            <div className="flex items-start gap-2 font-medium"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {outcome.summary}</div>
            <div className="flex items-center gap-2 text-xs">
              {outcome.phase === "sending" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending text to {outcome.to}…</> : <><Send className="h-3.5 w-3.5" /> Text sent ✓ <span className="text-stone-500">(simulated)</span></>}
            </div>
          </motion.div>
        ) : stillOpen ? (
          <motion.div key="act" exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-3">
            <button onClick={onApprove} className={`${btn.primary} min-h-11`}><ShieldCheck className="h-4 w-4" /> Approve rescue</button>
            <span className="text-xs text-stone-500">Cancels {c.recipient.name}&apos;s claim{c.plan === "waitlist" ? " and auto-claims for the waitlist" : " and sends the text"}.</span>
          </motion.div>
        ) : (
          <motion.p key="gone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-stone-500"><RotateCcw className="h-4 w-4" /> This pickup changed since the scan — scan again.</motion.p>
        )}
      </AnimatePresence>
    </Card>
  );
}

function Skeletons() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="animate-pulse rounded-3xl bg-white/70 p-6 ring-1 ring-brand-900/[0.04]">
          <div className="h-4 w-1/3 rounded-full bg-stone-200" />
          <div className="mt-3 h-3 w-2/3 rounded-full bg-stone-200" />
          <div className="mt-5 h-16 rounded-2xl bg-stone-100" />
        </div>
      ))}
    </div>
  );
}
