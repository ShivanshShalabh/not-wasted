"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Handshake, ImageUp, Send, Sparkles, Truck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { NO_SHOW, predictSurplus, WEATHER, type Weather } from "@/lib/forecast";
import { newId } from "@/lib/inventory";
import type { EventType, StorageType, Transport } from "@/lib/types";
import { currentAccount } from "@/lib/auth";
import { fileToBase64 } from "@/lib/format";
import { Dropzone } from "../Dropzone";
import { AiSourceBadge, btn, Field, inputCls } from "../ui";

const toLocal = (t: number) => new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function CreateEventForm({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useNotWasted();
  const me = currentAccount(state);
  const [showScan, setShowScan] = useState(false);
  const [more, setMore] = useState(false);
  const [shot, setShot] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<{ source: "oci" | "local"; fields: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState(() => {
    const start = Date.now() + 2 * 3600_000;
    return {
      name: "",
      institution: me?.orgName ?? "",
      department: "",
      address: me?.address ?? "",
      eventType: "" as EventType | "",
      start: toLocal(start),
      end: toLocal(start + 3 * 3600_000),
      rsvps: 0,
      foodOrdered: 0,
      mealDescription: "",
      storage: "Warm/Insulated" as StorageType,
      transport: "" as Transport | "",
      contact: me?.email ?? "",
      weather: "Clear" as Weather,
    };
  });

  async function scan(file: File) {
    setShot(file);
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/extract-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: await fileToBase64(file), mimeType: file.type }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not read screenshot");
      if (d.unreadable) {
        setScanned(null);
        setError("We couldn't read event details from that image — please fill the form in.");
        return;
      }
      // Copy only what the image actually showed; never invent quantities or defaults.
      const read: Partial<typeof f> = {};
      if (d.name) read.name = d.name;
      if (d.department) read.department = d.department;
      if (d.address) read.address = d.address;
      if (d.eventType && d.eventType in NO_SHOW && d.eventType !== "Other") read.eventType = d.eventType;
      if (d.start) read.start = toLocal(new Date(d.start).getTime());
      if (d.end) read.end = toLocal(new Date(d.end).getTime());
      if (d.rsvps > 0) read.rsvps = d.rsvps;
      if (d.foodOrdered > 0) read.foodOrdered = d.foodOrdered;
      if (d.mealDescription) read.mealDescription = d.mealDescription;
      if (d.contact) read.contact = d.contact;
      setF((p) => ({ ...p, ...read }));
      setScanned({ source: d.source, fields: Object.keys(read) });
      setShowScan(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  }
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  // Event-day weather (Open-Meteo) quietly adjusts the leftover forecast used for the T-45 ping.
  const eventDate = f.start.slice(0, 10);
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const d = await (await fetch(`/api/data/weather?date=${eventDate}`, { signal: ctrl.signal })).json();
        if (d.ok && d.data?.weather in WEATHER) setF((p) => ({ ...p, weather: d.data.weather as Weather }));
      } catch {
        /* keep the current setting */
      }
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [eventDate]);

  const eventType: EventType = f.eventType || "Other";
  const forecast = useMemo(() => predictSurplus({ ...f, eventType }), [f, eventType]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const start = new Date(f.start).getTime();
    const end = new Date(f.end).getTime();
    if (!(end > start)) return setError("Event end must be after start.");
    if (!f.transport) return setError("Tell us whether you'll deliver the leftovers or a food bank should pick them up.");
    dispatch({
      type: "CREATE_EVENT",
      event: {
        id: newId("evt"), name: f.name.trim() || `${f.institution || "Untitled"} event · ${new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, institution: f.institution, department: f.department, address: f.address,
        eventType, start, end, rsvps: f.rsvps, foodOrdered: f.foodOrdered, mealDescription: f.mealDescription,
        storage: f.storage, transport: f.transport as Transport, contact: f.contact, predictedSurplus: forecast.surplus, pingSent: false,
      },
    });
    onDone();
  }

  const fromShot = (k: string) => scanned?.fields.includes(k) ? <span className="ml-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">from screenshot</span> : null;

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-stone-600">Tell us about a catered event. We&apos;ll remind you 45 minutes before it ends so food banks can claim what&apos;s left.</p>

      {/* Optional shortcut: fill from an invite or flyer */}
      <div>
        <button type="button" onClick={() => setShowScan(!showScan)} aria-expanded={showScan}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-stone-600 transition hover:bg-brand-50 hover:text-brand-700">
          <ImageUp className="h-4 w-4" /> Have an invite or flyer? Fill from a screenshot <span className="text-stone-400">(optional)</span>
          <motion.span animate={{ rotate: showScan ? 180 : 0 }} className="inline-flex"><ChevronDown className="h-3.5 w-3.5" /></motion.span>
        </button>
        <AnimatePresence initial={false}>
          {showScan && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3"><Dropzone file={shot} onFile={scan} scanning={scanning} title="Drop a screenshot of your event" hint="We copy only details we can actually read. You review everything." /></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</motion.p>}
      </AnimatePresence>

      <form onSubmit={submit} className="grid grid-cols-2 gap-x-4 gap-y-5">
        {scanned && (
          <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-2xl bg-brand-50 px-4 py-2.5 text-sm text-brand-900">
            <Sparkles className="h-4 w-4" /> Filled {scanned.fields.length} field{scanned.fields.length === 1 ? "" : "s"} from your screenshot — please check them.
            <AiSourceBadge source={scanned.source} />
            <button type="button" aria-label="Dismiss" onClick={() => setScanned(null)} className="ml-auto rounded-full p-1 transition hover:bg-white"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <div className="col-span-2"><Field label="Event name">{fromShot("name")}<input required className={inputCls} placeholder="Spring Career Fair" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field></div>
        <Field label="Starts">{fromShot("start")}<input type="datetime-local" required className={inputCls} value={f.start} onChange={(e) => set("start", e.target.value)} /></Field>
        <Field label="Ends">{fromShot("end")}<input type="datetime-local" required min={f.start} className={inputCls} value={f.end} onChange={(e) => set("end", e.target.value)} /></Field>
        <div className="col-span-2"><Field label="Address">{fromShot("address")}<input required className={inputCls} placeholder="Street, city" value={f.address} onChange={(e) => set("address", e.target.value)} /></Field></div>
        <Field label="Expected guests">{fromShot("rsvps")}<input type="number" min={0} required className={inputCls} value={f.rsvps || ""} placeholder="0" onChange={(e) => set("rsvps", +e.target.value)} /></Field>
        <Field label="Portions ordered">{fromShot("foodOrdered")}<input type="number" min={0} required className={inputCls} value={f.foodOrdered || ""} placeholder="0" onChange={(e) => set("foodOrdered", +e.target.value)} /></Field>
        <div className="col-span-2"><Field label="What's being served (optional)">{fromShot("mealDescription")}<input className={inputCls} placeholder="Boxed lunches, salads, cookies" value={f.mealDescription} onChange={(e) => set("mealDescription", e.target.value)} /></Field></div>

        <fieldset className="col-span-2">
          <legend className="mb-2 text-sm font-medium text-stone-700">Who moves the leftovers?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {([["Donor delivers", "We'll deliver it", Truck], ["Recipient picks up", "A food bank picks it up", Handshake]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="radio" aria-checked={f.transport === value} onClick={() => set("transport", value)}
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium ring-1 transition hover:-translate-y-px ${f.transport === value ? "bg-brand-600 text-white ring-brand-600 shadow-card" : "bg-white text-stone-700 ring-stone-200 hover:bg-brand-50 hover:ring-brand-200"}`}>
                <Icon className="h-4 w-4 shrink-0" /> {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="col-span-2">
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-stone-600 transition hover:text-brand-700">
            More details (optional) <motion.span animate={{ rotate: more ? 180 : 0 }} className="inline-flex"><ChevronDown className="h-3.5 w-3.5" /></motion.span>
          </button>
          <AnimatePresence initial={false}>
            {more && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-2 gap-4 pt-3">
                  <Field label="Event type">{fromShot("eventType")}
                    <select className={inputCls} value={f.eventType} onChange={(e) => set("eventType", e.target.value as EventType | "")}>
                      <option value="">Not specified</option>
                      {Object.keys(NO_SHOW).map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Department / team">{fromShot("department")}<input className={inputCls} placeholder="Career Center" value={f.department} onChange={(e) => set("department", e.target.value)} /></Field>
                  <div className="col-span-2"><Field label="Who gets the 45-minute reminder">{fromShot("contact")}<input className={inputCls} placeholder="events@school.edu" value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button type="submit" className={`${btn.primary} col-span-2`}>
          <Send className="h-4 w-4" /> Register event
        </button>
      </form>
    </div>
  );
}
