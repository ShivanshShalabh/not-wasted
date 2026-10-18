"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUp, Bell, Bot, CheckCircle2, Clock, Info, Loader2, MapPin, Megaphone, Package, RotateCcw, Snowflake, Sparkles, User } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { missingFields, STORAGE_CHOICES, type IntakeDraft, type MissingField } from "@/lib/agents/intake";
import type { AgentStep } from "@/lib/agents/trace";
import { currentAccount } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { newId } from "@/lib/inventory";
import { matchRecipients } from "@/lib/matching";
import { ALLERGEN_OPTIONS, DIETARY_OPTIONS, Pill } from "../../AttributeTags";
import { AiSourceBadge, Badge, btn, Card, CategoryChip, inputCls } from "../../ui";
import { AgentTrace } from "../AgentTrace";
import { useAgent } from "../useAgent";

interface IntakeResponse {
  draft: IntakeDraft;
  missing: MissingField[];
  questions: { field: MissingField; text: string }[];
  suggestedPickupBy: number;
  steps: AgentStep[];
  source: "oci" | "local";
  error?: string;
}

interface Bubble { id: string; from: "donor" | "agent"; text: string }

const EXAMPLES = [
  "~80 sandwiches left in Rand Hall, gone by 3pm",
  "About 40 trays of pasta and salad from the career fair at the Student Life Center",
  "We have 25 boxes of bagels and cream cheese, need pickup by 11:30",
];

const QUESTION: Record<MissingField, string> = {
  qty: "Roughly how many portions or items are there?",
  pickupBy: "When does it need to be picked up by?",
  location: "Where should the food bank collect it — building and room?",
  storage: "How is it being kept right now?",
  allergens: "I spotted these possible allergens from the description. Are they right?",
};

/** Keep only recognised allergens/dietary tags; models sometimes return placeholders like "varies". */
const pick = (list: string[] | undefined, options: string[]) =>
  [...new Set((list ?? []).map((v) => options.find((o) => o.toLowerCase() === v.trim().toLowerCase())).filter((v): v is string => !!v))];
const clean = (d: IntakeDraft): IntakeDraft => ({ ...d, attributes: { ...d.attributes, allergens: pick(d.attributes.allergens, ALLERGEN_OPTIONS), dietary: pick(d.attributes.dietary, DIETARY_OPTIONS) } });

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const toHHMM = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const fromHHMM = (v: string, now: number) => {
  const [h, m] = v.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() < now) d.setDate(d.getDate() + 1);
  return d.getTime();
};

export function IntakePanel() {
  const { state, dispatch } = useNotWasted();
  const me = currentAccount(state);
  const canPost = me?.role === "donor";
  const agent = useAgent<IntakeResponse>("/api/agents/intake");
  const [input, setInput] = useState("");
  const [log, setLog] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [detected, setDetected] = useState<string[]>([]);
  const [posted, setPosted] = useState<{ title: string; alerts: { name: string; channel: string; contact: string }[] } | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  const say = (from: Bubble["from"], text: string) => {
    setLog((l) => [...l, { id: newId("msg"), from, text }]);
    setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  };

  async function send(text: string) {
    const t = text.trim();
    if (!t || agent.loading) return;
    setInput("");
    setPosted(null);
    setDraft(null);
    say("donor", t);
    const res = await agent.run({ text: t });
    if (!res) return;
    const d = clean(res.draft);
    setDraft(d);
    setDetected(d.attributes.allergens ?? []);
    const unit = CATEGORIES[d.category].unit;
    const parts = [
      d.qty ? `${d.qty} ${unit}` : null,
      d.location ? `at ${d.location}` : null,
      d.pickupBy ? `pickup by ${fmtTime(d.pickupBy)}` : null,
    ].filter(Boolean);
    const miss = missingFields(d);
    say("agent", `Got it — ${d.title}${parts.length ? `, ${parts.join(", ")}` : ""}. ${miss.length ? `${miss.length} quick question${miss.length > 1 ? "s" : ""} before I post it.` : "That's everything I need — review the draft and post when ready."}`);
  }

  function answer(field: MissingField, patch: Partial<IntakeDraft>, reply: string) {
    if (!draft) return;
    setDraft({ ...draft, ...patch, attributes: { ...draft.attributes, ...patch.attributes } });
    say("agent", QUESTION[field]);
    say("donor", reply);
  }

  const missing = draft ? missingFields(draft) : [];
  const active = missing[0];

  const matches = useMemo(() => {
    if (!draft) return [];
    return matchRecipients({ category: draft.category, title: draft.title, qty: draft.qty || 1, attributes: draft.attributes }, state.recipients);
  }, [draft, state.recipients]);

  function post() {
    if (!draft || missing.length || !canPost || !draft.qty || !draft.pickupBy) return;
    const postedAt = Date.now();
    dispatch({
      type: "BROADCAST",
      batch: {
        id: newId("bat"), category: draft.category, title: draft.title.trim() || "Surplus donation",
        institution: me?.orgName ?? "", department: draft.location, address: me?.address ?? draft.location,
        totalQty: draft.qty, remainingQty: draft.qty, status: "AVAILABLE", attributes: draft.attributes,
        transport: "Recipient picks up", postedAt, pickupBy: draft.pickupBy, aiSource: agent.data?.source ?? "local",
      },
    });
    setPosted({ title: draft.title, alerts: matches.slice(0, 5).map((m) => ({ name: m.recipient.name, channel: m.recipient.notifyChannel, contact: m.recipient.contact })) });
  }

  function restart() {
    agent.reset();
    setLog([]);
    setDraft(null);
    setPosted(null);
    setInput("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <div className="min-w-0 space-y-6">
        <Card className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-stone-600">
            Type what you have the way you&apos;d text a friend. The agent identifies the food, pulls out quantity, place and pickup time, then asks only for what&apos;s missing. You review the draft before anything is posted.
          </p>

          <div className="max-h-[440px] min-h-40 space-y-3 overflow-y-auto rounded-2xl bg-stone-50/70 p-4 ring-1 ring-stone-100" aria-live="polite">
            {!log.length && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-stone-500">Try one of these</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => send(ex)} className="min-h-11 cursor-pointer rounded-full bg-white px-4 py-2 text-left text-sm text-stone-700 ring-1 ring-brand-100 transition hover:-translate-y-0.5 hover:bg-brand-50 hover:text-brand-700">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {log.map((b) => <ChatBubble key={b.id} from={b.from}>{b.text}</ChatBubble>)}
              {draft && !agent.loading && active && !posted && (
                <ChatBubble key={`q-${active}`} from="agent">
                  <div className="space-y-3">
                    <p>{QUESTION[active]}</p>
                    <QuickReply field={active} draft={draft} detected={detected} suggested={agent.data?.suggestedPickupBy ?? Date.now() + 3 * 3600_000} onAnswer={answer} />
                  </div>
                </ChatBubble>
              )}
              {draft && !agent.loading && !active && !posted && log.length > 2 && (
                <ChatBubble key="ready" from="agent">All set — the draft on the right is ready. Post it when you&apos;re happy.</ChatBubble>
              )}
            </AnimatePresence>
            {agent.loading && (
              <ChatBubble from="agent"><span className="inline-flex items-center gap-2 text-stone-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your message…</span></ChatBubble>
            )}
            <div ref={chatEnd} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
            <label htmlFor="intake-msg" className="sr-only">Describe your surplus</label>
            <textarea id="intake-msg" value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="~80 sandwiches left in Rand Hall, gone by 3pm"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              className={`${inputCls} resize-none`} />
            <button type="submit" disabled={!input.trim() || agent.loading} aria-label="Send message" className={`${btn.primary} h-11 w-11 shrink-0 !px-0`}>
              {agent.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </form>
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
          <AgentTrace steps={agent.steps} running={agent.loading} idle="Send a message to see how the agent reads it." />
        </Card>
      </div>

      <div className="min-w-0 space-y-4">
        {!canPost && (
          <div className="flex items-start gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-800 ring-1 ring-sky-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> You&apos;re signed in as a recipient. You can try the parser, but only donor accounts can post donations.
          </div>
        )}
        {agent.loading && !draft && <DraftSkeleton />}
        {!agent.loading && !draft && (
          <div className="rounded-3xl border border-dashed border-brand-200 bg-white/50 px-6 py-14 text-center">
            <Package className="mx-auto h-6 w-6 text-brand-500" />
            <p className="mt-3 text-sm font-semibold text-ink">Your draft appears here</p>
            <p className="mt-1 text-sm text-stone-500">It fills in live as you answer the agent&apos;s questions.</p>
          </div>
        )}
        {draft && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
            <DraftCard draft={draft} missing={missing} source={agent.data?.source} onTitle={(title) => setDraft({ ...draft, title })} locked={!!posted} />
          </motion.div>
        )}

        {draft && !posted && matches.length > 0 && (
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-ink">Top matches</h3>
            <ol className="space-y-2">
              {matches.slice(0, 3).map((m, i) => (
                <motion.li key={m.recipient.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-start gap-3 rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-stone-100">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 tabular">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{m.recipient.name}</span><Pill tone="brand"><span className="tabular">{m.score}%</span></Pill></div>
                    <p className="text-xs text-stone-500">{m.reasons.slice(0, 3).join(" · ")}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </Card>
        )}

        {draft && (
          <AnimatePresence mode="wait" initial={false}>
            {posted ? (
              <motion.div key="posted" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-[#2f6b3d]" role="status"><CheckCircle2 className="h-5 w-5" /> Posted · alerted {posted.alerts.length} food bank{posted.alerts.length === 1 ? "" : "s"}</div>
                  <ul className="space-y-1.5">
                    {posted.alerts.map((a, i) => (
                      <motion.li key={a.name} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2"><Bell className="h-3.5 w-3.5 text-brand-600" /> {a.name}</span>
                        <span className="text-xs text-stone-500">{a.channel} ✓</span>
                      </motion.li>
                    ))}
                  </ul>
                  <p className="text-xs text-stone-400">Alerts are simulated in this demo.</p>
                  <button onClick={restart} className={`${btn.secondary} min-h-11`}><RotateCcw className="h-4 w-4" /> Start a new donation</button>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="post" className="space-y-2">
                <button onClick={post} disabled={!canPost || missing.length > 0} className={`${btn.primary} min-h-11 w-full`}>
                  <Megaphone className="h-4 w-4" /> Post &amp; alert matches
                </button>
                <p className="text-center text-xs text-stone-500">
                  {!canPost ? "Only donors can post." : missing.length ? `Answer ${missing.length} more question${missing.length > 1 ? "s" : ""} to post.` : `Posts the batch and alerts ${Math.min(5, matches.length)} matched org${Math.min(5, matches.length) === 1 ? "" : "s"}.`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ from, children }: { from: Bubble["from"]; children: ReactNode }) {
  const mine = from === "donor";
  return (
    <motion.div layout initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${mine ? "bg-stone-200 text-stone-600" : "bg-brand-600 text-white"}`}>
        {mine ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </span>
      <div className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed ${mine ? "rounded-br-lg bg-brand-600 text-white" : "rounded-bl-lg bg-white text-ink shadow-sm ring-1 ring-stone-100"}`}>{children}</div>
    </motion.div>
  );
}

function QuickReply({ field, draft, detected, suggested, onAnswer }: {
  field: MissingField; draft: IntakeDraft; detected: string[]; suggested: number;
  onAnswer: (field: MissingField, patch: Partial<IntakeDraft>, reply: string) => void;
}) {
  const [qty, setQty] = useState("");
  const [time, setTime] = useState(() => toHHMM(suggested));
  const [loc, setLoc] = useState("");
  const [allergens, setAllergens] = useState<string[]>(detected);
  const unit = CATEGORIES[draft.category].unit;
  const okBtn = `${btn.primary} min-h-11 !px-4`;

  if (field === "qty") {
    const n = Math.round(Number(qty));
    return (
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (n > 0) onAnswer("qty", { qty: n }, `${n} ${unit}`); }}>
        <input type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="80" aria-label={`Quantity in ${unit}`} className={`${inputCls} tabular w-28`} autoFocus />
        <button disabled={!(n > 0)} className={okBtn}>Confirm</button>
      </form>
    );
  }
  if (field === "pickupBy") {
    return (
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (time) { const ts = fromHHMM(time, Date.now()); onAnswer("pickupBy", { pickupBy: ts }, `By ${fmtTime(ts)}`); } }}>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Pickup by" className={`${inputCls} tabular w-36`} />
        <button disabled={!time} className={okBtn}>Confirm</button>
      </form>
    );
  }
  if (field === "location") {
    return (
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (loc.trim()) onAnswer("location", { location: loc.trim() }, loc.trim()); }}>
        <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Rand Hall, room 204" aria-label="Pickup location" className={inputCls} autoFocus />
        <button disabled={!loc.trim()} className={okBtn}>Confirm</button>
      </form>
    );
  }
  if (field === "storage") {
    return (
      <div className="flex flex-wrap gap-2">
        {STORAGE_CHOICES.map((s) => (
          <button key={s} onClick={() => onAnswer("storage", { attributes: { ...draft.attributes, storage: s } }, s)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-sky-50 px-4 text-sm font-medium text-sky-800 ring-1 ring-sky-200 transition hover:-translate-y-0.5 hover:bg-sky-100">
            <Snowflake className="h-3.5 w-3.5" /> {s}
          </button>
        ))}
      </div>
    );
  }
  // allergens
  const toggle = (a: string) => setAllergens((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]));
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">{detected.length ? "Detected ones are pre-selected. Tap to add or remove." : "I didn't spot any common allergens. Tap any that apply."}</p>
      <div className="flex flex-wrap gap-1.5">
        {[...detected, ...ALLERGEN_OPTIONS.filter((o) => !detected.includes(o))].map((a) => {
          const on = allergens.includes(a);
          return (
            <button key={a} onClick={() => toggle(a)} aria-pressed={on}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 transition hover:-translate-y-0.5 ${on ? "bg-red-50 text-red-700 ring-red-300" : "bg-white text-stone-500 ring-stone-200 hover:ring-red-200"}`}>
              {on && <AlertTriangle className="h-3.5 w-3.5" />} {a}{detected.includes(a) && <span className="text-[10px] font-normal opacity-70">detected</span>}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onAnswer("allergens", { allergensConfirmed: true, attributes: { ...draft.attributes, allergens } }, allergens.length ? `Contains ${allergens.join(", ")}` : "No allergens")} className={okBtn}>
          {allergens.length ? "Confirm these" : "Confirm"}
        </button>
        <button onClick={() => onAnswer("allergens", { allergensConfirmed: true, attributes: { ...draft.attributes, allergens: [] } }, "None of these")} className={`${btn.ghost} min-h-11`}>None of these</button>
      </div>
    </div>
  );
}

function DraftCard({ draft, missing, source, onTitle, locked }: { draft: IntakeDraft; missing: MissingField[]; source?: "oci" | "local"; onTitle: (t: string) => void; locked: boolean }) {
  const unit = CATEGORIES[draft.category].unit;
  const need = <Badge tone="amber">Needed</Badge>;
  const a = draft.attributes;
  const row = (icon: ReactNode, label: string, value: ReactNode, field?: MissingField) => (
    <div className="flex items-center justify-between gap-3 border-t border-stone-100 py-2.5 text-sm first:border-t-0">
      <span className="flex items-center gap-2 text-stone-500">{icon} {label}</span>
      <span className="text-right font-medium text-ink">{field && missing.includes(field) ? need : value}</span>
    </div>
  );
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500"><Sparkles className="h-3.5 w-3.5 text-brand-500" /> Live draft</span>
        <div className="flex items-center gap-1.5"><CategoryChip category={draft.category} />{source && <AiSourceBadge source={source} />}</div>
      </div>
      <label className="block">
        <span className="sr-only">Title</span>
        <input value={draft.title} onChange={(e) => onTitle(e.target.value)} disabled={locked} className="w-full rounded-xl border border-transparent bg-transparent px-2 py-1 font-display text-xl font-semibold text-ink outline-none transition hover:border-stone-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
      </label>
      <div>
        {row(<Package className="h-4 w-4" />, "Quantity", <span className="tabular">{draft.qty} {unit}</span>, "qty")}
        {row(<MapPin className="h-4 w-4" />, "Location", draft.location, "location")}
        {row(<Clock className="h-4 w-4" />, "Pickup by", draft.pickupBy ? <span className="tabular">{fmtTime(draft.pickupBy)}</span> : null, "pickupBy")}
        {draft.category === "food" && row(<Snowflake className="h-4 w-4" />, "Storage", a.storage, "storage")}
      </div>
      {draft.category === "food" && (
        <div className="flex flex-wrap gap-1.5">
          {missing.includes("allergens") && (a.allergens?.length ?? 0) > 0 && <span className="text-xs text-stone-500">Possible allergens, unconfirmed:</span>}
          {a.allergens?.map((x) => <Badge key={x} tone="red"><AlertTriangle className="h-3 w-3" /> {x}</Badge>)}
          {!missing.includes("allergens") && !a.allergens?.length && <Pill>No allergens</Pill>}
          {a.dietary?.map((x) => <Pill key={x}>{x}</Pill>)}
        </div>
      )}
    </Card>
  );
}

function DraftSkeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-3xl bg-white/70 p-6 ring-1 ring-brand-900/[0.04]" aria-hidden>
      <div className="h-3 w-24 rounded-full bg-stone-200" />
      <div className="h-6 w-2/3 rounded-full bg-stone-200" />
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-4 rounded-full bg-stone-100" />)}
    </div>
  );
}
