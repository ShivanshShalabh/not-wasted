"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bot, CalendarClock, Check, CheckCheck, CloudRain, CloudSun, Copy, Database, ExternalLink, GraduationCap, HandHeart, Loader2, MailCheck, MapPin, Play, Radar, RefreshCw, Send, Snowflake, Sparkles, Sun, ThermometerSun, Users, UtensilsCrossed } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { currentAccount, distanceMi, NETWORK_CENTER } from "@/lib/auth";
import { matchRecipients } from "@/lib/matching";
import type { ScoutedEvent } from "@/lib/scout";
import type { RecipientOrg } from "@/lib/types";
import { Pill } from "@/components/AttributeTags";
import { EPA_SOURCE, findOnNetwork, fullAddress, loadEpaDirectory, mealsPerWeek, placeholderEmail, type EpaDirectory } from "@/components/impact/publicData";
import { AiSourceBadge, AnimatedNumber, Badge, btn, Card, EmptyState, GettingStarted, inputCls, PageHeader } from "@/components/ui";

const SOURCES = ["Eventbrite", "Campus events calendars", "Hospital GME calendars", "Chamber of Commerce feed", "Meetup"];
const TOP_N = 4;
const TRACE_LINES = 3;
const LIVE_MS = 30_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type StepStatus = "pending" | "running" | "done";
interface Step { id: number; title: string; status: StepStatus; detail: string[]; at?: number }
interface FitChip { name: string; score: number; reason: string }
interface Draft { subject: string; body: string; source: "oci" | "local" | "template"; loading: boolean; sent: boolean; approved: boolean; sending?: boolean; sentAt?: number }

/** Scout events come back enriched by /api/agent/scout with real public data. */
type AgentEvent = ScoutedEvent & { weather?: { factor: string; summary: string } | null; lat?: number; lng?: number };
/** Anything the outreach drafter can write to: a scouted event, or a public-data prospect shaped like one. */
interface Outreachable { id: string; name: string; organizer: string; organizerEmail: string; venue: string; start: string; attendees: number; catering: string; predictedSurplus: number; source: string }
interface Prospect extends Outreachable { kind: "school" | "foodbank"; address: string; website?: string; tons?: [number, number]; miles?: number; type?: string }
interface Prospects { schools: Prospect[]; banks: Prospect[]; error?: string }

const S = { scan: 1, collect: 2, weather: 3, forecast: 4, match: 5, draft: 6, prospects: 7, ready: 8 } as const;
const STEP_TITLES = ["Scanning event feeds", "Collecting upcoming catered events", "Checking event-day weather (Open-Meteo)", "Forecasting leftovers", "Matching food banks", "Drafting outreach emails", "Finding public-data prospects (EPA)", "Ready for your review"];
const PROSPECT_N = 5;

const WEATHER_ICON: Record<string, typeof Sun> = { Clear: Sun, Rain: CloudRain, Snow: Snowflake, Heat: ThermometerSun };
function WeatherChip({ w }: { w: AgentEvent["weather"] }) {
  if (!w) return <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500 ring-1 ring-stone-200"><CloudSun className="h-3 w-3" /> Weather unavailable</span>;
  const Icon = WEATHER_ICON[w.factor] ?? CloudSun;
  const adjusted = w.factor !== "Clear";
  return (
    <span title={`Open-Meteo event-day forecast${adjusted ? " · leftover forecast adjusted for weather" : ""}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${adjusted ? "bg-sky-50 text-sky-800 ring-sky-200" : "bg-white text-stone-600 ring-stone-200"}`}>
      <Icon className="h-3 w-3" /> {w.summary}{adjusted && <b className="font-semibold"> · forecast adjusted</b>}
    </span>
  );
}

function buildProspects(dir: EpaDirectory, recipients: RecipientOrg[], from: { lat: number; lng: number }, totalMeals: number): Prospects {
  const start = new Date().toISOString();
  const schools: Prospect[] = dir.schools.ok
    ? dir.schools.data.slice(0, PROSPECT_N).map((s) => ({
        id: `epa-${s.id}`, kind: "school", name: "Ongoing cafeteria surplus", organizer: s.name, organizerEmail: placeholderEmail(s.name),
        venue: fullAddress(s), address: fullAddress(s), start, attendees: 0, catering: `Cafeteria surplus (EPA estimate ${s.excessTonsLow}–${s.excessTonsHigh} tons/yr; low estimate used)`,
        predictedSurplus: mealsPerWeek(s.excessTonsLow), source: EPA_SOURCE, website: s.website, tons: [s.excessTonsLow, s.excessTonsHigh], type: s.kind,
      }))
    : [];
  const banks: Prospect[] = dir.recipients.ok
    ? dir.recipients.data
        .filter((r) => !findOnNetwork(r.name, recipients))
        .map((r) => ({
          id: `epa-${r.id}`, kind: "foodbank" as const, name: "Coordinating surplus pickups", organizer: r.name, organizerEmail: placeholderEmail(r.name),
          venue: fullAddress(r), address: fullAddress(r), start, attendees: 0, catering: "Overflow from catered events", predictedSurplus: totalMeals,
          source: EPA_SOURCE, website: r.website, type: r.type, miles: Number.isFinite(r.lat) ? Math.round(distanceMi(from, { lat: r.lat, lng: r.lng }) * 10) / 10 : undefined,
        }))
        .sort((a, b) => (a.miles ?? 99) - (b.miles ?? 99))
        .slice(0, PROSPECT_N)
    : [];
  const errs = [dir.schools, dir.recipients].filter((a) => !a.ok).map((a) => (a.ok ? "" : `${a.source}: ${a.error}`));
  return { schools, banks, error: errs.length ? errs.join("; ") : undefined };
}
const freshSteps = (): Step[] => STEP_TITLES.map((title, i) => ({ id: i + 1, title, status: "pending", detail: [] }));
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function OutreachAgent() {
  const { state } = useNotWasted();
  const me = currentAccount(state);
  const isDonor = me?.role === "donor";
  const myOrg: RecipientOrg | undefined = me?.recipientId ? state.recipients.find((r) => r.id === me.recipientId) : undefined;

  const [steps, setSteps] = useState<Step[]>(freshSteps);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [prospects, setProspects] = useState<Prospects | null>(null);
  const [fits, setFits] = useState<Record<string, FitChip[]>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [live, setLive] = useState(false);
  const [lastScan, setLastScan] = useState<number | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const runId = useRef(0);

  const patch = (id: number, p: Partial<Step> | ((s: Step) => Partial<Step>)) =>
    setSteps((ss) => ss.map((s) => (s.id === id ? { ...s, ...(typeof p === "function" ? p(s) : p) } : s)));
  const log = (id: number, line: string) => patch(id, (s) => ({ detail: [...s.detail, line] }));

  const fetchScout = async (): Promise<AgentEvent[]> => {
    const res = await fetch("/api/agent/scout", { cache: "no-store" });
    const json = (await res.json()) as { events: AgentEvent[] };
    return json.events ?? [];
  };

  const computeFit = useCallback((e: ScoutedEvent): FitChip[] => {
    const input = { category: "food" as const, title: `${e.name} catering leftovers`, qty: e.predictedSurplus, attributes: { items: [e.catering] } };
    if (isDonor) {
      return matchRecipients(input, state.recipients, 10).slice(0, 3).map((m) => ({ name: m.recipient.name, score: Math.round(m.score), reason: m.reasons.slice(0, 2).join(" · ") }));
    }
    if (!myOrg) return [];
    const m = matchRecipients(input, [myOrg], 30)[0];
    return m ? [{ name: myOrg.name, score: Math.round(m.score), reason: m.reasons.slice(0, 3).join(" · ") }] : [{ name: myOrg.name, score: 0, reason: "Outside your stated requirements or capacity" }];
  }, [isDonor, myOrg, state.recipients]);

  const draftFor = useCallback(async (e: Outreachable) => {
    if (!me) return;
    setDrafts((d) => ({ ...d, [e.id]: { subject: d[e.id]?.subject ?? "", body: d[e.id]?.body ?? "", source: d[e.id]?.source ?? "local", loading: true, sent: false, approved: d[e.id]?.approved ?? true } }));
    if ((e as Prospect).kind === "foodbank") {
      // Peer-to-peer coordination note: a fixed template, not the event-leftovers prompt.
      await sleep(500);
      setDrafts((d) => ({ ...d, [e.id]: { ...d[e.id], loading: false, source: "template",
        subject: `Sharing surplus food pickups in Nashville: ${me.orgName} × ${e.organizer}`,
        body: `Hi ${e.organizer} team,\n\nI'm ${me.contactName} with ${me.orgName}. We use Not Wasted, a free network that routes surplus food from Nashville events, schools and businesses to nearby food banks and pantries.\n\nSome days there is more than one organization can take (our agent is tracking ~${e.predictedSurplus} meals of upcoming catering leftovers this week). Would you be open to joining the network so overflow can go to you instead of the landfill? Sign-up takes a few minutes and you set what you can accept.\n\nHappy to talk or share how pickups work.\n\nThanks,\n${me.contactName}\n${me.orgName}` } }));
      return;
    }
    try {
      const res = await fetch("/api/ai/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: { name: e.name, organizer: e.organizer, organizerEmail: e.organizerEmail, venue: e.venue, start: e.start, attendees: e.attendees, catering: e.catering, predictedSurplus: e.predictedSurplus, source: e.source },
          sender: { orgName: me.orgName, contactName: me.contactName, role: isDonor ? "donor" : "recipient", requirements: myOrg?.requirements },
        }),
      });
      const j = (await res.json()) as { subject: string; body: string; source: "oci" | "local" };
      setDrafts((d) => ({ ...d, [e.id]: { ...d[e.id], subject: j.subject, body: j.body, source: j.source, loading: false } }));
    } catch {
      setDrafts((d) => ({ ...d, [e.id]: { ...d[e.id], subject: `Leftover catering from ${e.name}`, body: `Hi ${e.organizer} team,\n\nWe'd love to pick up any leftover food after ${e.name}. Could we coordinate?\n\nThanks,\n${me.contactName}\n${me.orgName}`, source: "local", loading: false } }));
    }
  }, [me, isDonor, myOrg]);

  const run = async () => {
    const id = ++runId.current;
    const alive = () => runId.current === id;
    setRunning(true);
    setSteps(freshSteps());
    setEvents([]); setFits({}); setDrafts({}); setNewIds(new Set()); setProspects(null);

    patch(S.scan, { status: "running", at: Date.now() });
    const fetched = fetchScout();
    const epa = loadEpaDirectory().catch((err: Error) => err);
    for (const src of SOURCES) { await sleep(380); if (!alive()) return; log(S.scan, `Checked ${src}`); }
    const evs = await fetched.catch(() => [] as AgentEvent[]);
    if (!alive()) return;
    patch(S.scan, { status: "done" });

    patch(S.collect, { status: "running", at: Date.now() });
    await sleep(500);
    log(S.collect, `Found ${evs.length} upcoming events with catering in the next 5 days`);
    evs.forEach((e) => log(S.collect, `${e.name} · ${e.attendees} RSVPs · ${e.source}`));
    setEvents(evs); setLastScan(Date.now());
    patch(S.collect, { status: "done" });

    patch(S.weather, { status: "running", at: Date.now() });
    const geocoded = evs.filter((e) => e.lat != null).length;
    log(S.weather, `Geocoded ${geocoded}/${evs.length} venues with the U.S. Census Geocoder${geocoded < evs.length ? " (others use the city center)" : ""}`);
    for (const e of evs) {
      await sleep(200); if (!alive()) return;
      log(S.weather, e.weather ? `${e.name}: ${e.weather.summary}${e.weather.factor !== "Clear" ? ` → ${e.weather.factor.toLowerCase()} adjusts no-shows` : ""}` : `${e.name}: forecast unavailable, assuming clear`);
    }
    patch(S.weather, { status: "done" });

    patch(S.forecast, { status: "running", at: Date.now() });
    for (const e of evs) { await sleep(260); if (!alive()) return; log(S.forecast, `${e.name}: ~${e.predictedSurplus} meals left over (${Math.round(e.confidence * 100)}% confidence${e.weather && e.weather.factor !== "Clear" ? ", weather-adjusted" : ""})`); }
    patch(S.forecast, { status: "done" });

    patch(S.match, { status: "running", at: Date.now() });
    const f: Record<string, FitChip[]> = {};
    for (const e of evs) {
      await sleep(240); if (!alive()) return;
      f[e.id] = computeFit(e);
      log(S.match, isDonor ? `${e.name} → ${f[e.id].map((c) => c.name).join(", ") || "no food bank in range"}` : `${e.name} → fit ${f[e.id][0]?.score ?? 0}/100 for ${myOrg?.name ?? "your org"}`);
    }
    setFits(f);
    patch(S.match, { status: "done" });

    patch(S.draft, { status: "running", at: Date.now() });
    const top = [...evs].sort((a, b) => (isDonor ? b.predictedSurplus - a.predictedSurplus : (f[b.id]?.[0]?.score ?? 0) - (f[a.id]?.[0]?.score ?? 0))).slice(0, TOP_N);
    top.forEach((e) => log(S.draft, `Writing to ${e.organizerEmail}`));
    await Promise.all(top.map((e) => draftFor(e)));
    if (!alive()) return;
    log(S.draft, `${top.length} drafts generated in parallel`);
    patch(S.draft, { status: "done" });

    patch(S.prospects, { status: "running", at: Date.now() });
    const dir = await epa;
    if (!alive()) return;
    if (dir instanceof Error) {
      log(S.prospects, `${EPA_SOURCE} unavailable: ${dir.message}`);
      setProspects({ schools: [], banks: [], error: `${EPA_SOURCE}: ${dir.message}` });
    } else {
      const from = myOrg?.area?.lat != null && myOrg.area.lng != null ? { lat: myOrg.area.lat, lng: myOrg.area.lng } : NETWORK_CENTER;
      const p = buildProspects(dir, state.recipients, from, evs.reduce((n, e) => n + e.predictedSurplus, 0));
      setProspects(p);
      if (isDonor) p.schools.forEach((x) => log(S.prospects, `${x.organizer}: ${Math.round(x.tons![0])}–${Math.round(x.tons![1])} t/yr excess food`));
      else p.banks.forEach((x) => log(S.prospects, `${x.organizer}${x.miles != null ? ` · ${x.miles} mi` : ""} · not yet on Not Wasted`));
      if (p.error) log(S.prospects, `Partial data: ${p.error}`);
    }
    patch(S.prospects, { status: "done" });

    patch(S.ready, { status: "running", at: Date.now() });
    await sleep(400);
    log(S.ready, `${top.length} emails awaiting human approval — nothing is sent automatically`);
    patch(S.ready, { status: "done" });
    setRunning(false);
    setLive(true);
  };

  // Live feed: re-scan every 30s and surface newly detected events.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(async () => {
      const evs = await fetchScout().catch(() => null);
      if (!evs) return;
      setLastScan(Date.now());
      setEvents((prev) => {
        const known = new Set(prev.map((e) => e.id));
        const fresh = evs.filter((e) => !known.has(e.id));
        if (fresh.length) {
          setNewIds(new Set(fresh.map((e) => e.id)));
          setFits((ff) => ({ ...ff, ...Object.fromEntries(fresh.map((e) => [e.id, computeFit(e)])) }));
        }
        const byId = new Map(evs.map((e) => [e.id, e]));
        return [...prev.map((e) => byId.get(e.id) ?? e), ...fresh];
      });
    }, LIVE_MS);
    return () => clearInterval(t);
  }, [live, computeFit]);

  useEffect(() => () => { runId.current++; }, []);

  if (!me) return null;

  // Demo send: simulates delivery (no email actually leaves the app).
  const send = async (e: Outreachable) => {
    const d = drafts[e.id]; if (!d || d.loading || d.sending) return;
    setDrafts((x) => ({ ...x, [e.id]: { ...x[e.id], sending: true } }));
    await sleep(900 + Math.random() * 600);
    setDrafts((x) => ({ ...x, [e.id]: { ...x[e.id], sending: false, sent: true, sentAt: Date.now() } }));
  };
  const sendAll = async () => {
    for (const e of [...events, ...prospectList]) {
      const d = drafts[e.id];
      if (d && d.approved && !d.sent && !d.loading) { void send(e); await sleep(350); }
    }
  };
  const copy = async (e: Outreachable) => {
    const d = drafts[e.id]; if (!d) return;
    try { await navigator.clipboard.writeText(`To: ${e.organizerEmail}\nSubject: ${d.subject}\n\n${d.body}`); } catch { /* ignore */ }
    setCopied(e.id); setTimeout(() => setCopied(null), 1500);
  };
  const edit = (id: string, p: Partial<Draft>) => setDrafts((x) => ({ ...x, [id]: { ...x[id], ...p } }));

  const prospectList: Prospect[] = prospects ? (isDonor ? prospects.schools : prospects.banks) : [];
  const pendingApproved = Object.values(drafts).filter((d) => d.approved && !d.sent && !d.loading).length;
  const totalMeals = events.reduce((s, e) => s + e.predictedSurplus, 0);
  const ordered = [...events].sort((a, b) => Number(!!drafts[b.id]) - Number(!!drafts[a.id]));

  const doneCount = steps.filter((s) => s.status === "done").length;
  const sentCount = Object.values(drafts).filter((d) => d.sent).length;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={<><Bot className="h-3.5 w-3.5" /> Outreach agent</>}
        title={isDonor ? "Catch leftovers" : "Find events nearby"}
        accent={isDonor ? "before they're thrown out." : "and ask for their leftovers."}
        description={isDonor
          ? "The agent scans Nashville event feeds, forecasts each event's leftovers, matches them to food banks in range and drafts an email to the organizer."
          : `The agent finds upcoming catered events, scores them for ${myOrg?.name ?? me.orgName} and drafts a request to each organizer for you.`}
        actions={<>
          {live && (
            <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-2 rounded-full bg-sage-100/80 px-3 py-1.5 text-xs font-medium text-[#2f6b3d] ring-1 ring-sage-500/40 backdrop-blur">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-sage-700" /></span>
              Live<span className="tabular">{lastScan ? ` · scanned ${clock(lastScan)}` : ""}</span>
            </motion.span>
          )}
          <button onClick={run} disabled={running} className={btn.primary}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : events.length ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Agent running…" : events.length ? "Run again" : "Run agent"}
          </button>
        </>}
      />

      <GettingStarted id="agent" title="How the outreach agent works" steps={[
        { title: "Run the agent", body: "It scans event feeds for upcoming catered events in the next few days." },
        { title: "Review the forecast", body: "Each event shows expected leftovers and the food banks it matched." },
        { title: "Edit and send", body: "Tweak the drafted emails, then send. Nothing goes out without your approval." },
      ]} />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
        <Card className="!p-0 lg:sticky lg:top-28">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-6 py-4">
            <div className="flex items-center gap-2 font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Radar className={`h-4 w-4 ${running ? "animate-spin [animation-duration:3s]" : ""}`} /></span> What the agent is doing</div>
            <span className="text-sm text-stone-500 tabular">{doneCount}/{steps.length}</span>
          </div>
          <div className="h-1 overflow-hidden bg-brand-100/60">
            <motion.div className="h-full w-full origin-left bg-gradient-to-r from-brand-500 to-brand-600" initial={{ scaleX: 0 }} animate={{ scaleX: doneCount / steps.length }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>
          <ol className="max-h-[68vh] space-y-1 overflow-y-auto p-3">
            {steps.map((s, idx) => {
              const shown = s.detail.slice(0, TRACE_LINES);
              const more = s.detail.length - shown.length;
              return (
                <motion.li key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04, type: "spring", stiffness: 260, damping: 26 }}
                  className={`rounded-2xl px-3 py-3 transition-colors ${s.status === "running" ? "bg-brand-50" : "hover:bg-brand-50/40"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${s.status === "done" ? "bg-brand-600 text-white" : s.status === "running" ? "bg-white text-brand-600 ring-2 ring-brand-500" : "bg-stone-100 text-stone-400"}`}>
                      {s.status === "done" ? <Check className="h-3.5 w-3.5" /> : s.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : s.id}
                    </span>
                    <span className={`flex-1 text-sm font-medium ${s.status === "pending" ? "text-stone-400" : "text-ink"}`}>{s.title}</span>
                    {s.at && <span className="text-xs text-stone-400 tabular">{clock(s.at)}</span>}
                  </div>
                  <AnimatePresence initial={false}>
                    {shown.length > 0 && (
                      <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="ml-3 mt-2 space-y-1 overflow-hidden border-l-2 border-brand-100 pl-6">
                        {shown.map((d, i) => (
                          <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="break-words text-xs leading-relaxed text-stone-500">{d}</motion.li>
                        ))}
                        {more > 0 && <li className="text-xs font-medium text-stone-400">and {more} more</li>}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ol>
          {!running && !events.length && <p className="border-t border-stone-100 px-6 py-4 text-sm text-stone-500">Press “Run agent” to watch it work step by step.</p>}
        </Card>

        <div className="space-y-6">
          {events.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/70 bg-white/90 px-6 py-5 shadow-lift ring-1 ring-brand-900/[0.04] backdrop-blur-xl">
              <dl className="flex flex-wrap gap-x-10 gap-y-3">
                {([["Events found", events.length], ["Meals forecast", totalMeals], ["Drafts", Object.keys(drafts).length], ["Sent", sentCount]] as const).map(([l, v]) => (
                  <div key={l}>
                    <dd className="font-display text-3xl font-bold leading-none text-brand-700"><AnimatedNumber value={v} /></dd>
                    <dt className="mt-1.5 text-xs text-stone-600">{l}</dt>
                  </div>
                ))}
              </dl>
              <button onClick={sendAll} disabled={!pendingApproved} className={btn.secondary}><CheckCheck className="h-4 w-4" /> <span>Send all approved <span className="tabular">({pendingApproved})</span></span></button>
            </motion.div>
          )}

          {!events.length && !running && (
            <EmptyState icon={<Sparkles className="h-6 w-6" />} title="No scan yet"
              action={<button onClick={run} className={btn.secondary}><Play className="h-4 w-4" /> Start a scan</button>}>
              The agent pulls upcoming catered events, forecasts leftovers and drafts organizer outreach you can send with one click.
            </EmptyState>
          )}
          {!events.length && running && (
            <div className="space-y-4">
              {[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-white/70 ring-1 ring-brand-100" />)}
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {ordered.map((e, i) => {
              const d = drafts[e.id];
              const chips = fits[e.id];
              return (
                <motion.div key={e.id} layout initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 3) * 0.05, type: "spring", stiffness: 240, damping: 26 } }} viewport={{ once: true, margin: "-40px" }} exit={{ opacity: 0, scale: 0.98 }}>
                  <Card interactive className={`group ${d?.sent ? "!ring-2 !ring-sage-500/50" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold leading-snug text-ink">{e.name}</h3>
                          <Badge>{e.eventType}</Badge>
                          {newIds.has(e.id) && <Pill tone="solid">New</Pill>}
                          {d?.sent && <Pill><MailCheck className="h-3 w-3" /> Sent</Pill>}
                        </div>
                        <div className="mt-1 text-sm text-stone-500">{e.organizer}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-4xl font-bold leading-none text-brand-700">~<AnimatedNumber value={e.predictedSurplus} /></div>
                        <div className="mt-1.5 text-xs text-stone-600">meals left over · <span className="tabular">{Math.round(e.confidence * 100)}%</span> confidence</div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-x-6 gap-y-2 text-sm text-stone-600 sm:grid-cols-2">
                      <span className="flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-brand-600" /> <span className="truncate">{e.venue}</span></span>
                      <span className="flex items-center gap-2"><CalendarClock className="h-4 w-4 shrink-0 text-brand-600" /> {when(e.start)}</span>
                      <span className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0 text-brand-600" /> <span className="tabular">{e.attendees}</span> attendees · <span className="tabular">{e.cateringPortions}</span> portions</span>
                      <span className="flex min-w-0 items-center gap-2"><UtensilsCrossed className="h-4 w-4 shrink-0 text-brand-600 transition-transform duration-500 group-hover:-rotate-12" /> <span className="truncate" title={e.catering}>{e.catering}</span></span>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200 transition hover:-translate-y-px hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200">
                        <ExternalLink className="h-3 w-3" /> {e.source}
                      </a>
                      {"weather" in e && <WeatherChip w={e.weather} />}
                      {chips?.map((c) => (
                        <span key={c.name} title={c.reason} className="inline-flex cursor-default items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-100">
                          {isDonor ? "Match: " : "Fit: "}{c.name} <span className="tabular font-semibold text-brand-900">{c.score}</span>
                        </span>
                      ))}
                      {chips && !chips.length && <Badge tone="amber">No recipient in range</Badge>}
                    </div>

                    <DraftArea item={e} d={d} running={running} copied={copied === e.id} onDraft={draftFor} onEdit={edit} onCopy={copy} onSend={send} />
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {prospects && (
            <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ type: "spring", stiffness: 220, damping: 26 }} className="space-y-4 pt-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-white/70 px-3 py-1 text-xs font-medium text-brand-700 shadow-sm backdrop-blur"><Database className="h-3.5 w-3.5" /> Public-data prospects</div>
                  <h2 className="text-lg font-semibold tracking-tight">{isDonor ? "Schools with the most estimated excess food (EPA)" : "Food banks near you not yet on Not Wasted (EPA)"}</h2>
                  <p className="mt-0.5 text-sm text-stone-500">{isDonor
                    ? "Real Davidson County institutions ranked by the EPA's excess-food estimate. Propose a standing cafeteria pickup."
                    : `Real pantries and food banks from the EPA map, nearest to ${myOrg?.name ?? "you"} first. Coordinate overflow with them.`}</p>
                </div>
              </div>
              {prospects.error && (
                <div role="alert" className="flex items-start gap-2 rounded-2xl bg-amber-50/80 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Couldn&apos;t load everything: {prospects.error}</div>
              )}
              {!prospectList.length && !prospects.error && <p className="text-sm text-stone-500">No prospects found in the EPA data right now.</p>}
              {prospectList.map((p, i) => {
                const d = drafts[p.id];
                const Icon = p.kind === "school" ? GraduationCap : HandHeart;
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 3) * 0.05, type: "spring", stiffness: 240, damping: 26 } }} viewport={{ once: true, margin: "-40px" }}>
                    <Card interactive className={`group ${d?.sent ? "!ring-2 !ring-sage-500/50" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"><Icon className="h-5 w-5" /></span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold leading-snug text-ink">{p.organizer}</h3>
                              {p.type && <Badge>{p.type}</Badge>}
                              {d?.sent && <Pill><MailCheck className="h-3 w-3" /> Sent</Pill>}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-sm text-stone-500"><MapPin className="h-3.5 w-3.5 shrink-0 text-brand-600" /> <span className="truncate">{p.address}</span>{p.miles != null && <span className="shrink-0 tabular">· {p.miles} mi</span>}</div>
                          </div>
                        </div>
                        {p.tons && (
                          <div className="text-right">
                            <div className="font-display text-3xl font-bold leading-none text-brand-700 tabular">{Math.round(p.tons[0]).toLocaleString()}–{Math.round(p.tons[1]).toLocaleString()}</div>
                            <div className="mt-1.5 text-xs text-stone-600">tons/yr excess food · up to ~<span className="tabular">{p.predictedSurplus.toLocaleString()}</span> meals/week</div>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200"><Database className="h-3 w-3" /> {p.source}</span>
                        {p.website && (
                          <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-brand-700 transition hover:bg-brand-50">
                            <ExternalLink className="h-3 w-3" /> Website
                          </a>
                        )}
                      </div>
                      <DraftArea item={p} d={d} running={running} copied={copied === p.id} onDraft={draftFor} onEdit={edit} onCopy={copy} onSend={send}
                        draftLabel={p.kind === "school" ? "Draft partnership email" : "Draft coordination email"} />
                    </Card>
                  </motion.div>
                );
              })}
            </motion.section>
          )}

          {events.length > 0 && (
            <p className="text-xs leading-relaxed text-stone-500">Demo note: the event feed itself is simulated (live connectors would poll Eventbrite, campus, hospital and Chamber calendars). The enrichment is real public data: venues are geocoded with the U.S. Census Geocoder and leftover forecasts use the Open-Meteo event-day forecast. Prospects come from the EPA Excess Food Opportunities Map. Contact addresses are example.org placeholders, never real inboxes, and “Send” simulates delivery.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Draft editor shared by event cards and public-data prospects. */
function DraftArea({ item, d, running, copied, onDraft, onEdit, onCopy, onSend, draftLabel = "Draft outreach email" }: {
  item: Outreachable; d: Draft | undefined; running: boolean; copied: boolean; draftLabel?: string;
  onDraft: (x: Outreachable) => void; onEdit: (id: string, p: Partial<Draft>) => void; onCopy: (x: Outreachable) => void; onSend: (x: Outreachable) => void;
}) {
  return d ? (
    <div className="mt-6 border-t border-stone-100 pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-stone-500">To <span className="font-medium text-stone-700">{item.organizerEmail}</span></div>
        {!d.loading && (d.source === "template" ? <Badge>Template</Badge> : <AiSourceBadge source={d.source} />)}
      </div>
      {d.loading ? (
        <div className="flex items-center gap-2 rounded-2xl bg-brand-50/40 px-4 py-8 text-sm text-stone-600"><Loader2 className="h-4 w-4 animate-spin text-brand-600" /> Drafting email…</div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <label className="sr-only" htmlFor={`subj-${item.id}`}>Subject</label>
          <input id={`subj-${item.id}`} value={d.subject} onChange={(ev) => onEdit(item.id, { subject: ev.target.value })} disabled={d.sent} className={`${inputCls} font-semibold disabled:bg-stone-50`} />
          <label className="sr-only" htmlFor={`body-${item.id}`}>Email body</label>
          <textarea id={`body-${item.id}`} value={d.body} onChange={(ev) => onEdit(item.id, { body: ev.target.value })} disabled={d.sent} rows={8}
            className={`${inputCls} mt-3 resize-y leading-relaxed disabled:bg-stone-50 disabled:text-stone-600`} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="mr-auto flex cursor-pointer items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={d.approved} onChange={(ev) => onEdit(item.id, { approved: ev.target.checked })} disabled={d.sent} className="h-4 w-4 accent-brand-600" /> Approved to send
            </label>
            <button onClick={() => onDraft(item)} disabled={d.sent} className={btn.ghost}><RefreshCw className="h-4 w-4" /> Regenerate</button>
            <button onClick={() => onCopy(item)} className={btn.ghost}>{copied ? <Check className="h-4 w-4 text-sage-700" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}</button>
            {d.sent ? (
              <motion.span initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="inline-flex items-center gap-1.5 rounded-full bg-sage-100/80 px-4 py-2.5 text-sm font-medium text-[#2f6b3d] ring-1 ring-sage-500/40">
                <MailCheck className="h-4 w-4" /> Delivered · <span className="tabular">{new Date(d.sentAt ?? Date.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </motion.span>
            ) : (
              <button onClick={() => onSend(item)} disabled={d.sending} className={btn.primary}>
                {d.sending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send</>}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  ) : (
    !running ? <button onClick={() => onDraft(item)} className={`${btn.secondary} mt-6`}><Sparkles className="h-4 w-4" /> {draftLabel}</button> : null
  );
}
