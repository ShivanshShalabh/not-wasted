"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, Copy, Download, FileText, Leaf, Loader2, Mail, Package, Play, RotateCcw, Scale, Send, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { DonorWeek } from "@/lib/agents/report";
import type { AgentStep } from "@/lib/agents/trace";
import { AiSourceBadge, AnimatedNumber, Badge, btn, Card, inputCls } from "../../ui";
import { AgentTrace } from "../AgentTrace";
import { useAgent } from "../useAgent";

interface Letter { institution: string; to: string; subject: string; body: string; source: "oci" | "local" }
interface ReportResponse {
  steps: AgentStep[];
  totals: { units: number; lbs: number; co2eKg: number; recipients: number };
  donors: DonorWeek[];
  weekOf: string;
  summary: string;
  letters: Letter[];
  error?: string;
}

const SCHEDULE_KEY = "nw-report-schedule";

/** Next Monday at 8:00 AM local time (today counts if it's Monday before 8). */
function nextMonday8(from = new Date()) {
  const d = new Date(from);
  d.setHours(8, 0, 0, 0);
  const add = (1 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + add);
  if (d <= from) d.setDate(d.getDate() + 7);
  return d;
}

export function ReportPanel() {
  const agent = useAgent<ReportResponse>("/api/agents/report");
  const [scheduled, setScheduled] = useState(false);
  const [next, setNext] = useState<Date | null>(null);
  useEffect(() => {
    try { setScheduled(localStorage.getItem(SCHEDULE_KEY) === "on"); } catch { /* storage unavailable */ }
    setNext(nextMonday8());
  }, []);
  const toggle = () => {
    const v = !scheduled;
    setScheduled(v);
    try { localStorage.setItem(SCHEDULE_KEY, v ? "on" : "off"); } catch { /* storage unavailable */ }
  };
  const writing = agent.steps.find((s) => s.title.startsWith("Writing summary"));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-6">
        <Card>
          <h3 className="text-lg font-semibold tracking-tight">Weekly impact report</h3>
          <p className="mt-1 text-sm text-stone-600">Totals the last 7 days of pickups, writes a network summary, and drafts a thank-you and receipt letter for each donor. Nothing is sent until you approve it.</p>

          <div className="mt-5 rounded-2xl bg-paper p-4 ring-1 ring-stone-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><CalendarClock className="h-5 w-5" /></span>
                <div>
                  <div id="sched-label" className="text-sm font-semibold text-ink">Run every Monday 8:00 AM</div>
                  <div className="text-xs text-stone-500">
                    {scheduled && next ? <>Next run: {next.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}, {next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</> : "Off. Run it by hand below."}
                  </div>
                </div>
              </div>
              <button role="switch" aria-checked={scheduled} aria-labelledby="sched-label" onClick={toggle}
                className={`relative inline-flex h-11 w-16 shrink-0 cursor-pointer items-center rounded-full p-1.5 transition-colors ${scheduled ? "bg-brand-600" : "bg-stone-300"}`}>
                <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className={`h-8 w-8 rounded-full bg-white shadow ${scheduled ? "ml-auto" : ""}`} />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-stone-400">Schedule is saved in this browser only (demo).</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className={`${btn.primary} min-h-11`} disabled={agent.loading} onClick={() => agent.run()}>
              {agent.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {agent.data ? "Run again" : "Run now"}
            </button>
            {agent.data && !agent.loading && <button className={`${btn.ghost} min-h-11`} onClick={agent.reset}><RotateCcw className="h-4 w-4" /> Clear</button>}
          </div>
          {agent.error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{agent.error}</p>}
        </Card>
        <Card className="bg-white/60">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">What the agent did</h3>
          <AgentTrace steps={agent.steps} running={agent.loading} idle="Run the report to see each step here." />
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        {!agent.data && agent.loading && (
          <div className="space-y-4" aria-hidden>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-3xl bg-white/70" />)}</div>
            <div className="h-32 animate-pulse rounded-3xl bg-white/60" />
            <div className="h-64 animate-pulse rounded-3xl bg-white/60" />
          </div>
        )}
        {!agent.data && !agent.loading && (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-white/50 px-6 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><FileText className="h-6 w-6" /></span>
            <p className="font-semibold">This week's report will appear here</p>
            <p className="mt-1 max-w-sm text-sm text-stone-500">Network totals, a short summary, and a draft letter for every donor that you can edit and approve.</p>
          </div>
        )}

        {agent.data && (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: "Units rescued", value: agent.data.totals.units, icon: Package },
                { label: "Lbs diverted", value: agent.data.totals.lbs, icon: Scale },
                { label: "Kg CO2e avoided", value: agent.data.totals.co2eKg, icon: Leaf },
                { label: "Recipients served", value: agent.data.totals.recipients, icon: Users },
              ].map((t, i) => (
                <motion.div key={t.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 26 }}>
                  <Card interactive className="h-full p-4">
                    <t.icon className="h-4 w-4 text-brand-600" />
                    <div className="mt-2 font-display text-3xl font-semibold tabular text-ink"><AnimatedNumber value={t.value} /></div>
                    <div className="text-xs text-stone-500">{t.label}</div>
                  </Card>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {agent.done && (
                <motion.div key="written" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <Card className="bg-gradient-to-br from-white/90 to-sage-100/60">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Sparkles className="h-4 w-4 text-brand-600" />
                      <h3 className="font-semibold">Network summary · week of {agent.data.weekOf}</h3>
                      <AiSourceBadge source={writing?.source === "OCI Generative AI" ? "oci" : "local"} />
                    </div>
                    <p className="text-sm leading-relaxed text-stone-700">{agent.data.summary}</p>
                  </Card>

                  <section>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold">Donor letters <span className="text-stone-400 tabular">({agent.data.letters.length})</span></h3>
                      <p className="text-xs text-stone-500">Estimates only — not tax advice.</p>
                    </div>
                    {agent.data.letters.length === 0 ? (
                      <Card><p className="text-sm text-stone-600">No donations were picked up in the last 7 days, so there are no letters this week.</p></Card>
                    ) : (
                      <div className="space-y-4">
                        {agent.data.letters.map((l, i) => <LetterCard key={l.institution} letter={l} donor={agent.data!.donors.find((d) => d.institution === l.institution)} i={i} />)}
                      </div>
                    )}
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

function LetterCard({ letter, donor, i }: { letter: Letter; donor?: DonorWeek; i: number }) {
  const [body, setBody] = useState(letter.body);
  const [send, setSend] = useState<"idle" | "sending" | "sent">("idle");
  const [copied, setCopied] = useState(false);
  const full = `To: ${letter.to || donor?.contactName || letter.institution}\nSubject: ${letter.subject}\n\n${body}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([full], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${letter.institution.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-impact-letter.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const approve = () => {
    setSend("sending");
    setTimeout(() => setSend("sent"), 1200);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, type: "spring", stiffness: 260, damping: 26 }}>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-ink">{letter.institution}</div>
            {donor && <div className="mt-0.5 text-xs text-stone-500 tabular">{donor.units} units · {donor.lbs.toLocaleString()} lbs · ~${donor.deduction.toLocaleString()} est. value</div>}
          </div>
          <div className="flex items-center gap-2">
            <AiSourceBadge source={letter.source} />
            {send === "sent" && <Badge tone="green"><Check className="h-3 w-3" /> Sent</Badge>}
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-stone-500">To</dt>
          <dd className="truncate text-ink">{letter.to || <span className="text-stone-400">{donor?.contactName ?? "No email on file"}</span>}</dd>
          <dt className="text-stone-500">Subject</dt>
          <dd className="text-ink">{letter.subject}</dd>
        </dl>
        <label className="mt-3 block">
          <span className="sr-only">Letter body for {letter.institution}</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={send !== "idle"} rows={13} className={`${inputCls} resize-y leading-relaxed disabled:bg-stone-50 disabled:text-stone-500`} />
        </label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <button className={`${btn.ghost} min-h-11`} onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}</button>
            <button className={`${btn.ghost} min-h-11`} onClick={download}><Download className="h-4 w-4" /> Download .txt</button>
          </div>
          {send === "sent" ? (
            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-sage-100 px-4 text-sm font-semibold text-[#2f6b3d]"><Check className="h-4 w-4" /> Sent</span>
          ) : (
            <button className={`${btn.primary} min-h-11`} onClick={approve} disabled={send !== "idle" || !body.trim()}>
              {send === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {send === "sending" ? "Sending…" : "Approve & send"}
            </button>
          )}
        </div>
        <AnimatePresence>
          {send === "sent" && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 flex items-center gap-1.5 text-sm text-[#2f6b3d]">
              <Mail className="h-4 w-4" /> Letter sent to {letter.to || letter.institution} (simulated).
            </motion.p>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
