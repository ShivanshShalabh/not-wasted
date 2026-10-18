"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, ExternalLink, HandHeart, Loader2, LocateFixed, MapPin, Search, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { DONOR_TYPES, distanceMi, hashPassword, NETWORK_CENTER, RECIPIENT_TYPES, SERVICE_RADIUS_MI, toMapXY } from "@/lib/auth";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/categories";
import { newId } from "@/lib/inventory";
import type { AreaNeed, Category, NotifyChannel, RecipientOrg, Role } from "@/lib/types";
import { Badge, btn, CATEGORY_STYLE, Field, inputCls } from "../ui";
import { SampleAccounts } from "./SampleAccounts";

interface Located { lat: number; lng: number; matchedAddress: string; tract: string | null }
interface TractAccess { tract: string; lowIncomeLowAccess: boolean; lowIncome: boolean; lowAccess1Mile: boolean; povertyRate: number; medianFamilyIncome: number | null; urban: boolean }
type Lookup =
  | { status: "idle" | "loading" }
  | { status: "notfound" | "error"; message: string; source?: string }
  | { status: "found"; geo: Located; geoSource: string; access: TractAccess | null; accessSource?: string; accessError?: string; need: number | null };

interface Nonprofit { ein: string; name: string; city: string; state: string; is501c3: boolean; url: string }
type NpSearch = { status: "idle" | "loading" } | { status: "done"; results: Nonprofit[]; source: string } | { status: "error"; message: string; source?: string };

const NP_SOURCE = "ProPublica Nonprofit Explorer · IRS data";

function SourceLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Source: {children}</span>;
}

/** "5601 NEW YORK AVE, NASHVILLE, TN, 37209" → "5601 New York Ave, Nashville, TN 37209". */
const prettyAddress = (a: string) =>
  a.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/, ([a-z]{2}), (\d{5})/i, (_, st: string, zip: string) => `, ${st.toUpperCase()} ${zip}`);

const reveal = { initial: { opacity: 0, y: 6, height: 0 }, animate: { opacity: 1, y: 0, height: "auto" }, exit: { opacity: 0, y: -4, height: 0 }, transition: { duration: 0.22 } };

const STEPS = ["Who are you?", "Where are you?", "Your organization"];

const DEFAULT_ACCEPTS: Record<string, Category[]> = {
  "Food pantry": ["food"],
  Shelter: ["food", "clothing", "furniture"],
  "Community center": ["food", "clothing", "other"],
  "Furniture bank": ["furniture"],
  "Clothing closet": ["clothing"],
};

export function RegisterWizard({ onSignIn }: { onSignIn: () => void }) {
  const { state, dispatch } = useNotWasted();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
  const lookedUp = useRef<string>("");
  const lookupSeq = useRef(0);
  const [np, setNp] = useState<NpSearch>({ status: "idle" });
  const [npPick, setNpPick] = useState<Nonprofit | null>(null);
  const [p, setP] = useState({
    orgName: "", orgType: "", contactName: "", email: "", phone: "", password: "", confirm: "",
    notifyChannel: "Email" as NotifyChannel, needs: "", requirements: "",
  });
  const [accepts, setAccepts] = useState<Category[]>(["food"]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); setError(null); };

  /** Demo mode fills every step with realistic sample data for the chosen role. */
  const [demo, setDemo] = useState(false);
  function fillSample(r: Role) {
    const tag = Math.random().toString(36).slice(2, 6);
    setLocError(null);
    if (r === "donor") {
      setAddress("1900 Belmont Blvd, Nashville, TN 37212");
      setCoords({ lat: 36.1335, lng: -86.7957 });
      void findAddress("1900 Belmont Blvd, Nashville, TN 37212");
      setP((x) => ({ ...x, orgName: "Belmont University", orgType: "School / University", contactName: "Jordan Lee, Events Office", email: `events+${tag}@belmont.edu`, phone: "+1 615-555-0177", password: "demo1234", confirm: "demo1234" }));
    } else {
      setAddress("617 Shelby Ave, Nashville, TN 37206");
      setCoords({ lat: 36.1711, lng: -86.7602 });
      void findAddress("617 Shelby Ave, Nashville, TN 37206");
      setP((x) => ({ ...x, orgName: "East Nashville Community Fridge", orgType: "Community center", contactName: "Ana Rivera, Coordinator", email: `fridge+${tag}@eastnash.org`, phone: "+1 615-555-0188", password: "demo1234", confirm: "demo1234", notifyChannel: "SMS", needs: "prepared meals, produce, winter coats",
        requirements: "Many of our neighbors are Muslim, so no pork — halal preferred. We have kids with severe peanut allergies, so nut-free only. Our fridge is small: hot or shelf-stable meals work best after 6pm. We can't take opened alcohol or anything past its use-by date." }));
      setAccepts(["food", "clothing"]);
    }
  }
  function toggleDemo() {
    if (!demo && role) fillSample(role);
    setDemo(!demo);
  }
  const miles = coords ? distanceMi(coords, NETWORK_CENTER) : null;

  /** Census Geocoder → tract → USDA Food Access Research Atlas, via /api/data/locate. */
  async function findAddress(q = address) {
    const query = q.trim();
    if (query.length < 6) return setLookup({ status: "notfound", message: "Type a full street address, city and state first." });
    if (lookedUp.current === query && lookup.status !== "idle" && lookup.status !== "error") return;
    lookedUp.current = query;
    const seq = ++lookupSeq.current;
    setLookup({ status: "loading" });
    setLocError(null);
    try {
      const res = await fetch(`/api/data/locate?address=${encodeURIComponent(query)}`);
      const body = await res.json();
      if (seq !== lookupSeq.current) return;
      const geo = body?.geo;
      if (!res.ok || !geo) return setLookup({ status: "error", message: body?.error ?? "Address lookup failed. You can still continue." });
      if (!geo.ok) return setLookup({ status: "error", message: "The Census Geocoder is unavailable right now. You can still continue.", source: geo.source });
      if (!geo.data) return setLookup({ status: "notfound", message: "No match in the Census address database. Check the street number, city and ZIP.", source: geo.source });
      const g = geo.data as Located;
      setCoords({ lat: g.lat, lng: g.lng });
      const access = body.access;
      setLookup({
        status: "found", geo: g, geoSource: geo.source, need: typeof body.need === "number" ? body.need : null,
        access: access?.ok && access.data ? access.data : null, accessSource: access?.source,
        accessError: access && !access.ok ? "Food-access data is unavailable right now." : undefined,
      });
    } catch {
      if (seq === lookupSeq.current) setLookup({ status: "error", message: "Couldn't reach the address service. You can still continue." });
    }
  }

  function locate() {
    if (!navigator.geolocation) return setLocError("Location is not available in this browser.");
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        if (!address.trim()) setAddress(`Near ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
        setLocating(false);
      },
      () => { setLocError("Couldn't get your location — type your address instead."); setLocating(false); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function verifyNonprofit() {
    const name = p.orgName.trim();
    if (name.length < 3) return setNp({ status: "error", message: "Enter your organization name first." });
    setNp({ status: "loading" });
    setNpPick(null);
    try {
      const res = await fetch(`/api/data/nonprofit?name=${encodeURIComponent(name)}&state=TN`);
      const body = await res.json();
      if (!res.ok || !body?.ok) return setNp({ status: "error", message: body?.error ? "IRS lookup is unavailable right now — you can still register." : "Lookup failed — you can still register.", source: body?.source });
      setNp({ status: "done", results: (body.data as Nonprofit[]).slice(0, 5), source: body.source });
    } catch {
      setNp({ status: "error", message: "Couldn't reach the IRS lookup — you can still register." });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    if (role === "recipient" && !p.orgType) return setError("Choose your organization type.");
    if (p.password.length < 8) return setError("Password must be at least 8 characters.");
    if (p.password !== p.confirm) return setError("Passwords don't match.");
    if (state.accounts.some((a) => a.email.toLowerCase() === p.email.trim().toLowerCase())) return setError("An account with this email already exists.");
    if (role === "recipient" && accepts.length === 0) return setError("Choose at least one thing you can accept.");
    setSaving(true);

    const accountId = newId("acc");
    let recipient: RecipientOrg | undefined;
    const area: AreaNeed | undefined = lookup.status === "found" && lookup.access && lookup.need != null
      ? { tract: lookup.access.tract, need: lookup.need, lowIncomeLowAccess: lookup.access.lowIncomeLowAccess, povertyRate: lookup.access.povertyRate, lat: lookup.geo.lat, lng: lookup.geo.lng }
      : undefined;
    if (role === "recipient") {
      const pos = coords ? toMapXY(coords.lat, coords.lng) : { x: 15 + Math.random() * 70, y: 12 + Math.random() * 55 };
      recipient = {
        id: newId("rcp"), name: p.orgName.trim(), type: p.orgType, address: address.trim(),
        distanceMi: miles != null ? Math.round(miles * 10) / 10 : 2.5, ...pos,
        acceptedCategories: accepts, capacity: Object.fromEntries(accepts.map((c) => [c, 50])),
        notifyChannel: p.notifyChannel, contact: p.notifyChannel === "SMS" && p.phone ? p.phone : p.email.trim(), verified: npPick?.is501c3 ?? true,
        needs: p.needs.split(",").map((s) => s.trim()).filter(Boolean), hasTruck: false, coldStorage: accepts.includes("food"),
        requirements: p.requirements.trim() || undefined,
        ...(area ? { area } : {}),
      };
    }
    dispatch({
      type: "REGISTER_ACCOUNT",
      recipient,
      account: {
        id: accountId, role, email: p.email.trim(), passwordHash: await hashPassword(p.password),
        orgName: p.orgName.trim(), orgType: p.orgType || "Other", address: address.trim(), lat: coords?.lat, lng: coords?.lng,
        contactName: p.contactName.trim(), phone: p.phone.trim(), recipientId: recipient?.id,
      },
    });
  }

  return (
    <div>
      {step === 0 ? (
        // Same one-click demo accounts as the sign-in screen.
        <div className="mb-8">
          <p className="mb-3 text-sm font-medium text-stone-700">Just exploring? Use a sample account</p>
          <SampleAccounts onPick={(em) => { const acc = state.accounts.find((x) => x.email === em); if (acc) dispatch({ type: "LOGIN", accountId: acc.id }); }} />
          <div className="mt-7 flex items-center gap-3 text-xs text-stone-500"><span className="h-px flex-1 bg-stone-200" /> or register your organization <span className="h-px flex-1 bg-stone-200" /></div>
        </div>
      ) : (
        <button onClick={onSignIn} className="group mb-7 flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-brand-50/80 px-4 py-3 text-left text-sm text-brand-900 ring-1 ring-brand-100 transition hover:-translate-y-0.5 hover:shadow-card hover:ring-brand-500">
          <span>Just exploring? <b>Use a sample donor or recipient account</b></span><ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
        </button>
      )}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <motion.div animate={{ backgroundColor: i <= step ? "#bf5320" : "#ffffff", color: i <= step ? "#fff" : "#57534e", scale: i === step ? 1.1 : 1 }}
              className={`flex h-8 w-8 shrink-0 ring-1 ${i === step ? "ring-4 ring-brand-100" : "ring-stone-200"} items-center justify-center rounded-full text-xs font-bold`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </motion.div>
            {i < STEPS.length - 1 && <div className="h-1 flex-1 overflow-hidden rounded-full bg-stone-200"><motion.div className="h-full rounded-full bg-brand-600" animate={{ width: i < step ? "100%" : "0%" }} /></div>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-3xl font-semibold tracking-tight">{STEPS[step]}</h2>
        <button type="button" onClick={toggleDemo} aria-pressed={demo}
          className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold transition hover:-translate-y-0.5 active:scale-95 ${demo ? "bg-brand-600 text-white shadow-[0_8px_18px_-8px_rgb(191_83_32/0.7)] hover:bg-brand-700" : "bg-white/80 text-stone-700 ring-1 ring-stone-200 hover:ring-brand-500"}`}>
          {demo ? "Demo autofill on" : "Demo autofill"}
        </button>
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -30 }} transition={{ duration: 0.22 }} className="mt-6">
          {step === 0 && (
            <div className="space-y-3">
              {([
                { r: "donor" as const, icon: Building2, title: "Donor", sub: "We have surplus food, furniture or clothing", eg: "Universities, companies, hospitals, hotels, venues" },
                { r: "recipient" as const, icon: HandHeart, title: "Recipient", sub: "We serve the community and can receive donations", eg: "Food pantries, shelters, community centers, nonprofits" },
              ]).map(({ r, icon: Icon, title, sub, eg }) => (
                <motion.button key={r} whileHover={{ y: -5 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 20 }} onClick={() => { setRole(r); if (demo) fillSample(r); else setP((x) => ({ ...x, orgType: "" })); go(1); }}
                  className={`group flex w-full items-start gap-4 rounded-3xl border border-white/80 bg-white/80 p-5 text-left shadow-card backdrop-blur transition-shadow duration-300 hover:shadow-[0_18px_40px_-18px_rgb(191_83_32/0.45)] ${role === r ? "ring-2 ring-brand-600" : "ring-1 ring-stone-200 hover:ring-2 hover:ring-brand-500/70"}`}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 transition duration-300 group-hover:-rotate-6 group-hover:bg-brand-600 group-hover:text-white"><Icon className="h-6 w-6" /></div>
                  <div className="flex-1">
                    <div className="font-semibold text-ink">{title}</div>
                    <div className="text-sm text-stone-600">{sub}</div>
                    <div className="mt-1.5 text-xs text-stone-500">{eg}</div>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 text-stone-400 transition duration-300 group-hover:translate-x-1 group-hover:text-brand-600" />
                </motion.button>
              ))}
              <p className="pt-2 text-center text-xs text-stone-500">Organizations only — individuals can&apos;t register.</p>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); go(2); }} className="space-y-5">
              <p className="text-sm text-stone-600">{role === "donor" ? "Where should recipients pick up?" : "Where should donations go?"} We match you with organizations nearby.</p>
              <Field label="Organization address">
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
                  <input required autoFocus className={`${inputCls} pl-9`} placeholder="2201 West End Ave, Nashville, TN 37203" value={address}
                    onChange={(e) => { setAddress(e.target.value); if (lookup.status !== "loading") setLookup({ status: "idle" }); }}
                    onBlur={() => { if (address.trim().length >= 10 && lookedUp.current !== address.trim()) void findAddress(); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void findAddress(); } }} />
                </div>
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => void findAddress()} disabled={lookup.status === "loading" || !address.trim()} className={btn.primary} aria-label="Find this address in the U.S. Census database">
                  {lookup.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} {lookup.status === "loading" ? "Finding…" : "Find address"}
                </button>
                <button type="button" onClick={locate} disabled={locating} className={btn.secondary}>
                  <LocateFixed className={`h-4 w-4 ${locating ? "animate-spin" : ""}`} /> {locating ? "Locating…" : "Use my location"}
                </button>
              </div>
              {locError && <p className="text-xs text-red-600">{locError}</p>}
              <AnimatePresence initial={false} mode="wait">
                {lookup.status === "found" && (
                  <motion.div key="found" {...reveal} className="overflow-hidden" aria-live="polite">
                    <div className="space-y-3 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-card ring-1 ring-brand-100 backdrop-blur">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100"><MapPin className="h-4 w-4" /></span>
                        <div className="min-w-0 text-sm">
                          <div className="font-semibold text-ink">{prettyAddress(lookup.geo.matchedAddress)}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                            {lookup.geo.tract && <Badge>Census tract <span className="tabular">{lookup.geo.tract}</span></Badge>}
                            <span className="tabular">{lookup.geo.lat.toFixed(4)}, {lookup.geo.lng.toFixed(4)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <SourceLabel>{lookup.geoSource}</SourceLabel>
                      </div>
                    </div>
                  </motion.div>
                )}
                {(lookup.status === "notfound" || lookup.status === "error") && (
                  <motion.div key="miss" {...reveal} className="overflow-hidden" role="alert">
                    <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <span>{lookup.message}{lookup.source && <span className="mt-0.5 block"><SourceLabel>{lookup.source}</SourceLabel></span>}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {miles != null && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl px-4 py-2.5 text-sm ${miles <= SERVICE_RADIUS_MI ? "bg-brand-50 text-brand-900" : "bg-amber-50 text-amber-900"}`}>
                  {miles <= SERVICE_RADIUS_MI ? `📍 ${miles.toFixed(1)} mi from downtown Nashville — inside our network.` : `You're ${Math.round(miles)} mi from Nashville. We're piloting in Nashville first, but you can still register.`}
                </motion.div>
              )}
              <p className="text-xs text-stone-500">Currently serving Nashville, TN.</p>
              <div className="flex gap-2">
                <button type="button" className={btn.ghost} onClick={() => go(0)}><ArrowLeft className="h-4 w-4" /> Back</button>
                <button className={`${btn.primary} flex-1`}>Continue <ArrowRight className="h-4 w-4" /></button>
              </div>
            </form>
          )}

          {step === 2 && role && (
            <form onSubmit={submit} className="grid grid-cols-2 gap-x-3 gap-y-4">
              <div className="col-span-2"><Field label="Organization name"><input required autoFocus className={inputCls} value={p.orgName} onChange={(e) => { setP({ ...p, orgName: e.target.value }); if (npPick) setNpPick(null); }} /></Field></div>
              {role === "recipient" && (
                <div className="col-span-2 -mt-1 space-y-2">
                  {npPick ? (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 rounded-2xl bg-sage-100/80 px-3.5 py-2.5 text-sm text-[#2f6b3d] ring-1 ring-sage-500/40" aria-live="polite">
                      <span className="flex min-w-0 items-center gap-2"><BadgeCheck className="h-4 w-4 shrink-0" />
                        <span className="min-w-0"><b>{npPick.is501c3 ? "Verified 501(c)(3)" : "IRS-registered nonprofit"}</b> · EIN <span className="tabular">{npPick.ein}</span><span className="block truncate text-xs">{npPick.name}, {npPick.city}</span></span>
                      </span>
                      <button type="button" className="min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold transition hover:bg-white/70" onClick={() => setNpPick(null)}>Change</button>
                    </motion.div>
                  ) : (
                    <button type="button" onClick={() => void verifyNonprofit()} disabled={np.status === "loading" || p.orgName.trim().length < 3} className={`${btn.secondary} w-full`} aria-label="Verify nonprofit status with IRS data">
                      {np.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {np.status === "loading" ? "Searching IRS records…" : "Verify nonprofit status"}
                    </button>
                  )}
                  <AnimatePresence initial={false}>
                    {!npPick && np.status === "done" && (
                      <motion.div key="np" {...reveal} className="overflow-hidden">
                        <div className="rounded-3xl border border-white/80 bg-white/80 p-2 shadow-card ring-1 ring-stone-200/70 backdrop-blur">
                          {np.results.length ? (
                            <ul className="space-y-1" aria-label="Matching nonprofits">
                              {np.results.map((r) => (
                                <li key={r.ein} className="flex items-center gap-1 rounded-2xl transition hover:bg-brand-50">
                                  <button type="button" onClick={() => setNpPick(r)} aria-label={`Select ${r.name}, ${r.city}, EIN ${r.ein}`}
                                    className="group flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 text-left">
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-semibold text-ink group-hover:text-brand-800">{r.name}</span>
                                      <span className="block text-xs text-stone-500">{r.city}, {r.state} · EIN <span className="tabular">{r.ein}</span></span>
                                    </span>
                                    {r.is501c3 ? <Badge tone="green"><BadgeCheck className="h-3 w-3" /> 501(c)(3)</Badge> : <Badge>Other exempt</Badge>}
                                  </button>
                                  <a href={r.url} target="_blank" rel="noreferrer" aria-label={`View ${r.name} on ProPublica`}
                                    className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-white hover:text-brand-700"><ExternalLink className="h-3.5 w-3.5" /></a>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="px-3 py-2 text-sm text-stone-600">No Tennessee nonprofits match that name. Try your legal name — or continue; we&apos;ll verify manually.</p>
                          )}
                          <div className="px-3 pb-1 pt-2"><SourceLabel>{NP_SOURCE}</SourceLabel></div>
                        </div>
                      </motion.div>
                    )}
                    {np.status === "error" && (
                      <motion.p key="nperr" {...reveal} role="alert" className="overflow-hidden text-xs text-amber-700">{np.message} <SourceLabel>{NP_SOURCE}</SourceLabel></motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}
              <div className="col-span-2">
                <Field label={role === "donor" ? "Organization type (optional)" : "Organization type"}>
                  <select className={inputCls} value={p.orgType} onChange={(e) => { setP({ ...p, orgType: e.target.value }); if (DEFAULT_ACCEPTS[e.target.value]) setAccepts(DEFAULT_ACCEPTS[e.target.value]); }}>
                    <option value="">Select…</option>
                    {(role === "donor" ? DONOR_TYPES : RECIPIENT_TYPES).map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              </div>

              {role === "recipient" && (
                <div className="col-span-2">
                  <div className="mb-1.5 text-sm font-medium text-stone-700">What can you accept?</div>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORY_LIST.map((c) => {
                      const Icon = CATEGORY_STYLE[c].icon;
                      const on = accepts.includes(c);
                      return (
                        <button key={c} type="button" onClick={() => setAccepts(on ? accepts.filter((x) => x !== c) : [...accepts, c])}
                          className={`flex min-h-11 flex-col items-center gap-1 rounded-2xl border p-2.5 text-xs font-semibold transition hover:-translate-y-0.5 ${on ? `border-transparent ring-2 ${CATEGORY_STYLE[c].chip}` : "border-stone-200 bg-white/70 text-stone-600 hover:border-brand-500"}`}>
                          <Icon className="h-4 w-4" /> {CATEGORIES[c].label}
                        </button>
                      );
                    })}
                  </div>
                  <input className={`${inputCls} mt-2`} placeholder="What you need most (optional): hot meals, coats, beds" value={p.needs} onChange={(e) => setP({ ...p, needs: e.target.value })} />
                </div>
              )}
              {role === "recipient" && (
                <div className="col-span-2">
                  <Field label="Requirements (optional)" hint="Dietary restrictions, allergies, what you can't take. We flag food that conflicts and rank donations for you.">
                    <textarea rows={3} className={inputCls} placeholder="e.g. No pork (halal preferred). Nut-free only. No refrigeration after 6pm." value={p.requirements} onChange={(e) => setP({ ...p, requirements: e.target.value })} />
                  </Field>
                </div>
              )}

              <div className="col-span-2 mt-2 border-t border-stone-200 pt-5 text-sm font-semibold text-ink">Contact information</div>
              <div className="col-span-2"><Field label="Contact name"><input required className={inputCls} value={p.contactName} onChange={(e) => setP({ ...p, contactName: e.target.value })} /></Field></div>
              <Field label="Email (sign-in)"><input type="email" required autoComplete="email" className={inputCls} value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field>
              <Field label="Phone"><input type="tel" autoComplete="tel" className={inputCls} value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
              {role === "recipient" && (
                <div className="col-span-2">
                  <Field label="Notify us about new donations by">
                    <div className="flex gap-2">
                      {(["Email", "SMS"] as const).map((c) => (
                        <button key={c} type="button" onClick={() => setP({ ...p, notifyChannel: c })} className={`min-h-11 flex-1 rounded-full py-2.5 text-sm font-medium ring-1 transition hover:-translate-y-0.5 ${p.notifyChannel === c ? "bg-brand-600 text-white ring-brand-600" : "bg-white/80 ring-stone-200 hover:ring-brand-500"}`}>{c}</button>
                      ))}
                    </div>
                  </Field>
                </div>
              )}

              <Field label="Create password"><input type="password" required minLength={8} autoComplete="new-password" className={inputCls} value={p.password} onChange={(e) => setP({ ...p, password: e.target.value })} /></Field>
              <Field label="Confirm password"><input type="password" required autoComplete="new-password" className={inputCls} value={p.confirm} onChange={(e) => setP({ ...p, confirm: e.target.value })} /></Field>

              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2 flex gap-2 pt-1">
                <button type="button" className={btn.ghost} onClick={() => go(1)}><ArrowLeft className="h-4 w-4" /> Back</button>
                <button disabled={saving} className={`${btn.primary} flex-1 min-h-12`}>Create account</button>
              </div>
            </form>
          )}
        </motion.div>
      </AnimatePresence>

      <p className="mt-8 text-center text-sm text-stone-600">
        Already registered? <button onClick={onSignIn} className="min-h-11 px-1 font-semibold text-brand-700 underline-offset-4 hover:underline">Sign in</button>
      </p>
    </div>
  );
}
