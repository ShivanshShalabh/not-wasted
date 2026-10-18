"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FlaskConical, Info, Loader2, Play, RotateCcw, Sparkles, TrendingDown, Users } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { DEMO_HISTORY, type Recommendation, type TypeModel } from "@/lib/agents/forecaster";
import type { AgentStep } from "@/lib/agents/trace";
import { AiSourceBadge, AnimatedNumber, Badge, btn, Card } from "../../ui";
import { AgentTrace } from "../AgentTrace";
import { useAgent } from "../useAgent";

interface ForecastResponse { steps: AgentStep[]; models: TypeModel[]; recs: Recommendation[]; advice: string; error?: string }

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function ForecastPanel() {
  const { state, dispatch } = useNotWasted();
  const agent = useAgent<ForecastResponse>("/api/agents/forecast");
  const [applied, setApplied] = useState<Record<string, number>>({});
  const own = state.events.filter((e) => e.batchId && state.batches.some((b) => b.id === e.batchId)).length;
  const upcoming = state.events.filter((e) => !e.batchId && e.end > Date.now()).length;

  const apply = (r: Recommendation) => {
    dispatch({ type: "UPDATE_EVENT_ORDER", eventId: r.eventId, foodOrdered: r.recommendedOrder, predictedSurplus: Math.max(0, r.recommendedOrder - r.expectedAttendance) });
    setApplied((a) => ({ ...a, [r.eventId]: r.recommendedOrder }));
  };
  const writing = agent.steps.find((s) => s.title === "Writing advice");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-6">
        <Card>
          <h3 className="text-lg font-semibold tracking-tight">Learn from past events</h3>
          <p className="mt-1 text-sm text-stone-600">Compares predicted and actual leftovers per event type, learns a calibrated no-show rate, and suggests a smaller catering order for upcoming events.</p>
          <div className="mt-4 flex gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
            <p>History includes <b className="tabular">{DEMO_HISTORY.length}</b> demo events (synthetic, for illustration) plus <b className="tabular">{own}</b> event{own === 1 ? "" : "s"} confirmed in this app.</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Badge tone={upcoming ? "green" : "gray"}><span className="tabular">{upcoming}</span> upcoming event{upcoming === 1 ? "" : "s"} to advise</Badge>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className={`${btn.primary} min-h-11`} disabled={agent.loading} onClick={() => { setApplied({}); agent.run(); }}>
              {agent.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {agent.data ? "Run again" : "Run forecaster"}
            </button>
            {agent.data && !agent.loading && <button className={`${btn.ghost} min-h-11`} onClick={() => { agent.reset(); setApplied({}); }}><RotateCcw className="h-4 w-4" /> Clear</button>}
          </div>
          {agent.error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{agent.error}</p>}
        </Card>
        <Card className="bg-white/60">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">What the agent did</h3>
          <AgentTrace steps={agent.steps} running={agent.loading} idle="Run the forecaster to see how it learns from past events." />
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        {!agent.data && agent.loading && (
          <div className="space-y-4" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white/60" />)}
          </div>
        )}
        {!agent.data && !agent.loading && (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-white/50 px-6 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><TrendingDown className="h-6 w-6" /></span>
            <p className="font-semibold">Forecasts will appear here</p>
            <p className="mt-1 max-w-sm text-sm text-stone-500">Learned no-show rates per event type, how much more accurate they are, and order sizes you can apply.</p>
          </div>
        )}

        {agent.data && (
          <>
            <section>
              <h3 className="mb-3 font-semibold">What it learned, by event type</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {agent.data.models.map((m, i) => <ModelCard key={m.eventType} m={m} i={i} />)}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-semibold">Upcoming events</h3>
              {agent.data.recs.length === 0 ? (
                <Card><p className="text-sm text-stone-600">No upcoming events registered. Register an event in the app to get order-size advice.</p></Card>
              ) : (
                <div className="space-y-3">
                  {agent.data.recs.map((r, i) => {
                    const ev = state.events.find((e) => e.id === r.eventId);
                    const done = applied[r.eventId] != null || (ev?.foodOrdered === r.recommendedOrder && r.foodOrdered !== r.recommendedOrder);
                    return <RecCard key={r.eventId} r={r} i={i} done={done} onApply={() => apply(r)} />;
                  })}
                </div>
              )}
            </section>

            <AnimatePresence>
              {agent.done && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="bg-gradient-to-br from-white/90 to-sage-100/60">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Sparkles className="h-4 w-4 text-brand-600" />
                      <h3 className="font-semibold">Agent advice</h3>
                      <AiSourceBadge source={writing?.source === "OCI Generative AI" ? "oci" : "local"} />
                    </div>
                    <p className="text-sm leading-relaxed text-stone-700">{agent.data.advice}</p>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

function Bar({ value, label, color, delay }: { value: number; label: string; color: string; delay: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 text-stone-500">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
        <motion.div className={`h-full origin-left rounded-full ${color}`} style={{ width: `${Math.min(100, value * 100)}%` }}
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay, type: "spring", stiffness: 120, damping: 20 }} />
      </div>
      <span className="w-9 shrink-0 text-right font-semibold tabular text-ink">{pct(value)}</span>
    </div>
  );
}

function ModelCard({ m, i }: { m: TypeModel; i: number }) {
  const better = m.errBefore > 0 ? Math.round((1 - m.errAfter / m.errBefore) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 26 }}>
      <Card interactive className="h-full p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-ink">{m.eventType}</div>
            <div className="text-xs text-stone-500 tabular">{m.n} past event{m.n === 1 ? "" : "s"}</div>
          </div>
          <span className="shrink-0 whitespace-nowrap">{better > 0 ? <Badge tone="green"><TrendingDown className="h-3 w-3" /> {better}% better</Badge> : better < 0 ? <Badge tone="amber">Default was closer</Badge> : <Badge>No change</Badge>}</span>
        </div>
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-medium text-stone-600">No-show rate</p>
          <Bar label="Default" value={m.defaultNoShow} color="bg-stone-300" delay={0.1 + i * 0.06} />
          <Bar label="Learned" value={m.learnedNoShow} color="bg-brand-600" delay={0.2 + i * 0.06} />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-paper px-3 py-2 text-sm ring-1 ring-stone-200">
          <span className="whitespace-nowrap text-stone-500">Back-test error</span>
          <span className="ml-auto font-semibold tabular text-stone-400 line-through decoration-stone-300">{pct(m.errBefore)}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          <span className={`font-semibold tabular ${m.errAfter <= m.errBefore ? "text-[#2f6b3d]" : "text-amber-700"}`}>{pct(m.errAfter)}</span>
        </div>
      </Card>
    </motion.div>
  );
}

function RecCard({ r, i, done, onApply }: { r: Recommendation; i: number; done: boolean; onApply: () => void }) {
  const noChange = r.recommendedOrder >= r.foodOrdered;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, type: "spring", stiffness: 260, damping: 26 }}>
      <Card interactive className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-ink">{r.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <Badge>{r.eventType}</Badge>
              <span className="inline-flex items-center gap-1 tabular"><Users className="h-3 w-3" /> {r.rsvps} RSVPs</span>
            </div>
          </div>
          {r.cutPct > 0 && <Badge tone="green"><span className="tabular">−{r.cutPct}%</span> catering</Badge>}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <div className="text-xs text-stone-500">Current order</div>
            <div className="font-display text-3xl font-semibold tabular text-stone-400 line-through decoration-stone-300 decoration-2">{r.foodOrdered}</div>
          </div>
          <ArrowRight className="mb-2 h-5 w-5 text-stone-400" />
          <div>
            <div className="text-xs text-stone-500">Recommended</div>
            <div className="font-display text-4xl font-semibold tabular text-brand-700"><AnimatedNumber value={r.recommendedOrder} /></div>
          </div>
          <dl className="ml-auto grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
            <dt className="text-stone-500">Expected guests</dt><dd className="text-right font-semibold tabular">{r.expectedAttendance}</dd>
            <dt className="text-stone-500">Forecast leftover</dt><dd className="text-right font-semibold tabular">{r.forecastLeftover}</dd>
          </dl>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
          <p className="flex items-center gap-1.5 text-xs text-stone-500"><Info className="h-3.5 w-3.5" /> Keeps a 5% buffer over expected guests.</p>
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.span key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-sage-100 px-4 text-sm font-semibold text-[#2f6b3d]">
                Applied ✓ — order set to <span className="tabular">{r.recommendedOrder}</span>
              </motion.span>
            ) : (
              <motion.button key="apply" exit={{ opacity: 0 }} className={`${btn.secondary} min-h-11`} onClick={onApply} disabled={noChange}>
                {noChange ? "Already right-sized" : <>Apply to event <ArrowRight className="h-4 w-4" /></>}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}
