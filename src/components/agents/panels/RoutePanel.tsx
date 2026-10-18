"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, Clock, Copy, Loader2, MapPin, Navigation, Play, RotateCcw, Send, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import type { PlannedStop } from "@/lib/agents/route";
import type { AgentStep } from "@/lib/agents/trace";
import { currentAccount, toMapXY } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { AgentTrace } from "../AgentTrace";
import { useAgent } from "../useAgent";
import { AnimatedNumber, Badge, btn, Card, inputCls } from "../../ui";

interface RouteResponse {
  steps: AgentStep[];
  route: PlannedStop[];
  totalMin: number;
  totalMi: number;
  start: { lat: number; lng: number };
  checklist: string;
  error?: string;
}

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function RoutePanel() {
  const { state } = useNotWasted();
  const me = currentAccount(state);
  const agent = useAgent<RouteResponse>("/api/agents/route");
  const openCount = (id: string) => state.claims.filter((c) => c.recipientId === id && c.status === "CLAIMED").length;
  // Recipients plan their own run; donors start on the org with the most open pickups.
  const [recipientId, setRecipientId] = useState(() => me?.recipientId ?? [...state.recipients].sort((a, b) => openCount(b.id) - openCount(a.id))[0]?.id ?? "");
  const org = state.recipients.find((r) => r.id === recipientId);
  const open = openCount(recipientId);
  const isRecipient = me?.role === "recipient";

  const pick = (id: string) => {
    setRecipientId(id);
    agent.reset();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-6">
        <Card>
          <h3 className="text-lg font-semibold tracking-tight">Plan a pickup run</h3>
          <p className="mt-1 text-sm text-stone-600">Orders your open pickups by deadline and drive time, flags vehicle and cold-chain needs, then writes a driver checklist.</p>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Organization</span>
            <select value={recipientId} onChange={(e) => pick(e.target.value)} disabled={isRecipient && !!me?.recipientId} className={`${inputCls} min-h-11 cursor-pointer disabled:cursor-default disabled:opacity-80`}>
              {state.recipients.map((r) => <option key={r.id} value={r.id}>{r.name}{openCount(r.id) ? ` (${openCount(r.id)} open)` : ""}</option>)}
            </select>
            {!isRecipient && <span className="mt-1 block text-xs text-stone-400">Donors can preview any recipient's run.</span>}
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={open ? "green" : "gray"}><span className="tabular">{open}</span> open pickup{open === 1 ? "" : "s"}</Badge>
            {org && <Badge tone={org.hasTruck ? "blue" : "gray"}><Truck className="h-3 w-3" /> {org.hasTruck ? "Has a truck" : "Van only"}</Badge>}
            {org?.coldStorage && <Badge tone="blue">Cold storage</Badge>}
          </div>
          {!open && <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">No open pickups yet. Claim something in the app first, then plan the run here.</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className={`${btn.primary} min-h-11`} disabled={!org || !open || agent.loading} onClick={() => agent.run({ recipientId })}>
              {agent.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {agent.data ? "Re-plan route" : "Plan route"}
            </button>
            {agent.data && !agent.loading && <button className={`${btn.ghost} min-h-11`} onClick={agent.reset}><RotateCcw className="h-4 w-4" /> Clear</button>}
          </div>
          {agent.error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{agent.error}</p>}
        </Card>
        <Card className="bg-white/60">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">What the agent did</h3>
          <AgentTrace steps={agent.steps} running={agent.loading} idle="Pick an organization and plan the route to see each step here." />
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        {!agent.data && agent.loading && <ResultSkeleton />}
        {!agent.data && !agent.loading && (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-white/50 px-6 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Navigation className="h-6 w-6" /></span>
            <p className="font-semibold">Your route will appear here</p>
            <p className="mt-1 max-w-sm text-sm text-stone-500">A map of the run, the stop order with arrival times, and a checklist you can send to the driver.</p>
          </div>
        )}
        {agent.data && (agent.data.route.length ? <RouteResult data={agent.data} orgName={org?.name ?? "Start"} revealed={agent.done} /> : (
          <Card><p className="text-sm text-stone-600">No open pickups for {org?.name}. Claim something in the app first.</p></Card>
        ))}
      </div>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-72 animate-pulse rounded-3xl bg-white/70 ring-1 ring-brand-100" />
      {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-3xl bg-white/60" />)}
    </div>
  );
}

/** Spread points that land on the same spot (e.g. ungeocoded addresses at the city center). */
function spread(pts: { x: number; y: number }[], r: number) {
  const seen = new Map<string, number>();
  return pts.map((p) => {
    const k = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    if (!n) return p;
    const a = n * 2.1;
    return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
  });
}

function RouteResult({ data, orgName, revealed }: { data: RouteResponse; orgName: string; revealed: boolean }) {
  const still = useReducedMotion();
  // Same projection as the network map, then zoomed to fit the run (keeping the 100×80 aspect).
  const { pts, box, k } = useMemo(() => {
    const raw = [toMapXY(data.start.lat, data.start.lng), ...data.route.map((s) => toMapXY(s.lat, s.lng))];
    const xs = raw.map((p) => p.x), ys = raw.map((p) => p.y);
    const w = Math.min(100, Math.max(36, (Math.max(...xs) - Math.min(...xs)) * 1.5 + 16, ((Math.max(...ys) - Math.min(...ys)) * 1.5 + 14) * 1.25));
    const h = w * 0.8;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2 + w * 0.08, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const box = { x: Math.min(100 - w, Math.max(0, cx - w / 2)), y: Math.min(80 - h, Math.max(0, cy - h / 2)), w, h };
    const k = w / 100;
    return { pts: spread(raw, 3.2 * k), box, k };
  }, [data]);
  const [start, ...stops] = pts;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const late = data.route.filter((s) => s.late).length;

  return (
    <>
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="font-semibold">Route map</h3>
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand-900" /> Start</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> On time</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Late</span>
          </div>
        </div>
        <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="w-full rounded-2xl bg-[#fbf3ea] ring-1 ring-brand-100" role="img" aria-label={`Route from ${orgName} through ${stops.length} stops`}>
          <defs>
            <radialGradient id="rt-glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#f8c9a6" stopOpacity="0.5" /><stop offset="100%" stopColor="#fbf3ea" stopOpacity="0" /></radialGradient>
          </defs>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="url(#rt-glow)" />
          <path d="M0 52 C 20 40, 35 60, 55 48 S 85 30, 100 42" stroke="#cfdfd2" strokeWidth={3 * k} strokeLinecap="round" fill="none" />
          <path d={d} stroke="#f8c9a6" strokeWidth={1.6 * k} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <motion.path key={d} d={d} stroke="#bf5320" strokeWidth={0.7 * k} strokeLinecap="round" strokeLinejoin="round" fill="none"
            initial={{ pathLength: still ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 + stops.length * 0.35, ease: "easeInOut" }} />
          <g>
            <rect x={start.x - 2 * k} y={start.y - 2 * k} width={4 * k} height={4 * k} rx={k} fill="#3d1a0c" />
            <text x={start.x + 3 * k} y={start.y + k} fontSize={2.3 * k} fontWeight="600" fill="#3d1a0c">{orgName}</text>
          </g>
          {stops.map((p, i) => {
            const s = data.route[i];
            return (
              <motion.g key={s.claim.id} initial={{ opacity: 0, scale: still ? 1 : 0.4 }} animate={{ opacity: 1, scale: 1 }} style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                transition={{ delay: still ? 0 : 0.5 + i * 0.35, type: "spring", stiffness: 300, damping: 18 }}>
                <title>{`${s.order}. ${s.batch.institution} · ETA ${time(s.arriveAt)}${s.late ? " · late" : ""}`}</title>
                <circle cx={p.x} cy={p.y} r={2.6 * k} fill={s.late ? "#dc2626" : "#bf5320"} stroke="#fff" strokeWidth={0.6 * k} />
                <text x={p.x} y={p.y + 0.95 * k} fontSize={2.6 * k} fontWeight="700" fill="#fff" textAnchor="middle" className="tabular">{s.order}</text>
              </motion.g>
            );
          })}
        </svg>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Stops", value: data.route.length, fmt: (n: number) => String(Math.round(n)) },
            { label: "Minutes", value: data.totalMin, fmt: (n: number) => String(Math.round(n)) },
            { label: "Miles", value: data.totalMi, fmt: (n: number) => n.toFixed(1) },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl bg-brand-50/70 px-3 py-3 ring-1 ring-brand-100">
              <dt className="text-xs text-stone-500">{t.label}</dt>
              <dd className="font-display text-2xl font-semibold tabular text-ink"><AnimatedNumber value={t.value} format={t.fmt} /></dd>
            </div>
          ))}
        </dl>
        {late > 0 && <p className="mt-3 flex items-center gap-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> {late} stop{late > 1 ? "s" : ""} would arrive after the pickup window. Call the donor or split the run.</p>}
      </Card>

      <div>
        <h3 className="mb-3 font-semibold">Stop order</h3>
        <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[21px] before:top-6 before:w-px before:bg-brand-200">
          <AnimatePresence>
            {data.route.map((s, i) => (
              <motion.li key={s.claim.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, type: "spring", stiffness: 260, damping: 26 }} className="relative flex gap-3">
                <span className={`relative z-10 mt-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm tabular ${s.late ? "bg-red-600" : "bg-brand-600"}`}>{s.order}</span>
                <Card interactive className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{s.batch.institution}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{s.batch.address}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular text-ink">{time(s.arriveAt)}</div>
                      <div className="text-xs text-stone-500 tabular">{s.driveMin} min drive</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge><span className="tabular">{s.claim.qty}</span> {CATEGORIES[s.batch.category].unit}</Badge>
                    <span className="text-xs text-stone-500">{s.batch.title}</span>
                    {s.late ? <Badge tone="red"><Clock className="h-3 w-3" /> Late · window closes {time(s.claim.pickupBy)}</Badge> : <Badge tone="green"><Check className="h-3 w-3" /> Before {time(s.claim.pickupBy)}</Badge>}
                  </div>
                  {s.warnings.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.warnings.map((w) => <Badge key={w} tone="amber"><AlertTriangle className="h-3 w-3" /> {w}</Badge>)}
                    </div>
                  )}
                </Card>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </div>

      {revealed ? <Checklist text={data.checklist} /> : <div className="h-40 animate-pulse rounded-3xl bg-white/60" aria-hidden />}
    </>
  );
}

function Checklist({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [send, setSend] = useState<"idle" | "sending" | "sent">("idle");
  useEffect(() => setSend("idle"), [text]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };
  const sendIt = () => {
    setSend("sending");
    setTimeout(() => setSend("sent"), 1100);
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Driver checklist</h3>
          <div className="flex flex-wrap gap-2">
            <button className={`${btn.ghost} min-h-11`} onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}</button>
            {send === "sent" ? (
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-sage-100 px-4 text-sm font-semibold text-[#2f6b3d]"><Check className="h-4 w-4" /> Sent to driver</span>
            ) : (
              <button className={`${btn.primary} min-h-11`} onClick={sendIt} disabled={send !== "idle"}>
                {send === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {send === "sending" ? "Sending…" : "Send to driver"}
              </button>
            )}
          </div>
        </div>
        <pre className="whitespace-pre-wrap rounded-2xl bg-paper px-4 py-3 font-sans text-sm leading-relaxed text-stone-700 ring-1 ring-stone-200">{text}</pre>
        <AnimatePresence>
          {send === "sent" && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 text-sm text-[#2f6b3d]">Checklist sent (simulated). The driver gets each stop as a text message.</motion.p>}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
