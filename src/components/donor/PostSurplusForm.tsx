"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Barcode, Camera, CheckCircle2, ChevronDown, Database, Handshake, Keyboard, Loader2, Plus, Radio, RotateCcw, Search, Sparkles, Truck, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { currentAccount } from "@/lib/auth";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/categories";
import { photoThumbnail } from "@/lib/format";
import { newId } from "@/lib/inventory";
import { STORAGE_TYPES, type Category, type Condition, type ItemAttributes, type QualityVerdict, type StorageType, type Transport } from "@/lib/types";
import { ALLERGEN_OPTIONS, CONDITION_OPTIONS, DIETARY_OPTIONS, itemKey, itemList } from "../AttributeTags";
import { Dropzone } from "../Dropzone";
import { AiSourceBadge, Badge, btn, CATEGORY_STYLE, CategoryChip, Field, inputCls } from "../ui";
import { useEvaluate, type Evaluation } from "../useEvaluate";

const QUALITY_STYLE: Record<QualityVerdict, { cls: string; icon: typeof CheckCircle2 }> = {
  "Good to donate": { cls: "bg-sage-100/80 text-[#2f6b3d] ring-sage-500/40", icon: CheckCircle2 },
  "Check before pickup": { cls: "bg-amber-50 text-amber-800 ring-amber-200", icon: AlertTriangle },
  "Not suitable": { cls: "bg-red-50 text-red-700 ring-red-200", icon: XCircle },
};

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const toggle = (list: string[] | undefined, v: string) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);

function Chips({ label, options, selected, tone, onToggle }: { label: string; options: string[]; selected?: string[]; tone: "red" | "green"; onToggle: (v: string) => void }) {
  const all = [...options, ...(selected ?? []).filter((v) => !options.some((o) => o.toLowerCase() === v.toLowerCase()))];
  const on = tone === "red" ? "bg-red-50 text-red-700 ring-red-300" : "bg-sage-100/80 text-[#2f6b3d] ring-sage-500/60";
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-stone-700">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {all.map((o) => {
          const active = selected?.some((v) => v.toLowerCase() === o.toLowerCase());
          return (
            <button key={o} type="button" aria-pressed={active} onClick={() => onToggle(selected?.find((v) => v.toLowerCase() === o.toLowerCase()) ?? o)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition duration-200 hover:-translate-y-px active:scale-95 ${active ? on : "bg-white text-stone-600 ring-stone-200 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"}`}>{o}</button>
          );
        })}
      </div>
    </div>
  );
}

type Product = { barcode: string; name: string; brand?: string; allergens: string[]; dietary: string[]; imageUrl?: string };
type FdcFood = { fdcId: number; description: string; category?: string; brand?: string; ingredients?: string; allergens: string[] };

const mergeCi = (a: string[] | undefined, b: string[]) => [...(a ?? []), ...b.filter((x) => !(a ?? []).some((y) => y.toLowerCase() === x.toLowerCase()))];

/** Build the same Evaluation shape an AI scan returns, from an Open Food Facts product. */
function productToEvaluation(p: Product): Evaluation {
  return {
    category: "food",
    title: p.name,
    summary: [p.brand, `Barcode ${p.barcode}`].filter(Boolean).join(" · "),
    pickupWindowHours: 72,
    attributes: { items: [p.name], allergens: p.allergens, dietary: p.dietary },
    source: "local",
    dataSource: "Open Food Facts",
    quality: { verdict: "Good to donate", notes: "Sealed packaged product (Open Food Facts)" },
  };
}

type BarcodeDetectorLike = { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

/** "Packaged food?" panel: type a barcode (or read one from a photo where the browser supports it) → Open Food Facts lookup. */
function BarcodeLookup({ onUse }: { onUse: (p: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [state, setState] = useState<{ status: "idle" | "loading" | "notfound" | "error"; msg?: string } | { status: "found"; product: Product }>({ status: "idle" });
  const [canDetect, setCanDetect] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setCanDetect(typeof window !== "undefined" && "BarcodeDetector" in window), []);

  async function lookup(raw: string) {
    const c = raw.replace(/\D/g, "");
    if (c.length < 8 || c.length > 14) return setState({ status: "error", msg: "Barcodes are 8–14 digits." });
    setState({ status: "loading" });
    try {
      const r = await fetch(`/api/data/barcode?code=${c}`);
      const d = await r.json();
      if (!d.ok) return setState({ status: "error", msg: d.error ?? "Lookup failed — try again or describe it instead." });
      if (!d.data) return setState({ status: "notfound" });
      setState({ status: "found", product: d.data });
    } catch {
      setState({ status: "error", msg: "Couldn't reach Open Food Facts — check your connection." });
    }
  }

  async function fromPhoto(file: File) {
    try {
      const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
      const found = await new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }).detect(await createImageBitmap(file));
      const v = found[0]?.rawValue;
      if (!v) return setState({ status: "error", msg: "No barcode found in that photo — type the digits instead." });
      setCode(v);
      void lookup(v);
    } catch {
      setState({ status: "error", msg: "Couldn't read that photo — type the digits instead." });
    }
  }

  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`${btn.ghost} min-h-11 w-full`}>
        <Barcode className="h-4 w-4" /> Packaged food? Scan or type a barcode
        <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown className="h-4 w-4" /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="overflow-hidden">
            <div className="mt-2 space-y-3 rounded-3xl bg-brand-50/40 p-4 ring-1 ring-brand-100">
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void lookup(code); }}>
                <label htmlFor="barcode-input" className="sr-only">Barcode digits</label>
                <input id="barcode-input" inputMode="numeric" autoComplete="off" pattern="[0-9 ]*" maxLength={18} className={`${inputCls} min-h-11 font-mono tracking-wider`} placeholder="e.g. 3017624010701"
                  value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} />
                {canDetect && (
                  <>
                    <button type="button" aria-label="Read barcode from a photo" title="Read barcode from a photo" className={`${btn.secondary} min-h-11 !px-3.5`} onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" /></button>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void fromPhoto(f); e.target.value = ""; }} />
                  </>
                )}
                <button type="submit" disabled={state.status === "loading" || code.replace(/\D/g, "").length < 8} className={`${btn.primary} min-h-11 shrink-0`}>
                  {state.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Look up
                </button>
              </form>
              <AnimatePresence mode="wait" initial={false}>
                {state.status === "found" && (
                  <motion.div key={`p-${state.product.barcode}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
                    {state.product.imageUrl
                      ? <img src={state.product.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-stone-50 object-contain ring-1 ring-stone-200" />
                      : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Barcode className="h-6 w-6" /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{state.product.name}</div>
                      <div className="truncate text-xs text-stone-500">{[state.product.brand, state.product.barcode].filter(Boolean).join(" · ")}</div>
                      {state.product.allergens.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{state.product.allergens.map((a) => <Badge key={a} tone="red">{a}</Badge>)}</div>}
                    </div>
                    <button type="button" className={`${btn.primary} min-h-11 shrink-0`} onClick={() => onUse(state.product)}><CheckCircle2 className="h-4 w-4" /> Use this</button>
                  </motion.div>
                )}
                {state.status === "notfound" && (
                  <motion.p key="nf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
                    Not in Open Food Facts yet. Check the digits, or describe the item instead.
                  </motion.p>
                )}
                {state.status === "error" && (
                  <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{state.msg}</motion.p>
                )}
              </AnimatePresence>
              <p className="text-[11px] text-stone-400">Data: Open Food Facts</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Food review helper: look up the dish in USDA FoodData Central and offer its detected allergens. */
function UsdaCheck({ query, current, onAdd }: { query: string; current?: string[]; onAdd: (allergens: string[]) => void }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "empty" } | { status: "error"; msg: string } | { status: "ok"; food: FdcFood; q: string }>({ status: "idle" });
  const [expanded, setExpanded] = useState(false);

  async function check() {
    const q = query.trim();
    if (!q) return;
    setState({ status: "loading" });
    setExpanded(false);
    try {
      const r = await fetch(`/api/data/ingredients?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (!d.ok) {
        const limited = r.status === 429 || /rate|limit|429/i.test(String(d.error ?? ""));
        return setState({ status: "error", msg: limited ? "USDA's free lookup limit was hit — try again in a bit, or tag allergens yourself." : "USDA lookup is unavailable right now — tag allergens yourself." });
      }
      const food = (d.data as FdcFood[])?.[0];
      setState(food ? { status: "ok", food, q } : { status: "empty" });
    } catch {
      setState({ status: "error", msg: "Couldn't reach USDA FoodData Central." });
    }
  }

  const missing = state.status === "ok" ? state.food.allergens.filter((a) => !current?.some((c) => c.toLowerCase() === a.toLowerCase())) : [];
  const ing = state.status === "ok" ? state.food.ingredients ?? "" : "";
  const long = ing.length > 160;

  return (
    <div className="space-y-2">
      <button type="button" onClick={check} disabled={!query.trim() || state.status === "loading"} className={`${btn.secondary} min-h-11 !py-2`}>
        {state.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
        {state.status === "loading" ? "Checking USDA…" : "Check ingredients with USDA"}
      </button>
      <AnimatePresence mode="wait" initial={false}>
        {state.status === "ok" && (
          <motion.div key={state.food.fdcId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="relative rounded-2xl bg-white p-4 text-sm ring-1 ring-stone-200">
            <button type="button" aria-label="Dismiss USDA result" onClick={() => setState({ status: "idle" })} className="absolute right-2 top-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"><X className="h-4 w-4" /></button>
            <div className="pr-8 text-xs text-stone-400">Closest USDA match for “{state.q}”</div>
            <div className="mt-0.5 pr-8 font-semibold text-stone-800">{state.food.description}</div>
            {(state.food.category || state.food.brand) && <div className="text-xs text-stone-500">{[state.food.category, state.food.brand?.trim()].filter(Boolean).join(" · ")}</div>}
            {ing && (
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                <span className="font-medium text-stone-700">Ingredients: </span>
                {expanded || !long ? ing.toLowerCase() : `${ing.slice(0, 160).toLowerCase()}…`}
                {long && <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="ml-1 cursor-pointer font-medium text-brand-700 underline-offset-2 hover:underline">{expanded ? "Show less" : "Show all"}</button>}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-stone-600">Detected allergens:</span>
              {state.food.allergens.length ? state.food.allergens.map((a) => <Badge key={a} tone="red">{a}</Badge>) : <span className="text-xs text-stone-400">none detected</span>}
            </div>
            {state.food.allergens.length > 0 && (
              <button type="button" disabled={!missing.length} onClick={() => onAdd(state.food.allergens)} className={`${btn.ghost} mt-2 min-h-11 !px-3 text-brand-700`}>
                {missing.length ? <><Plus className="h-4 w-4" /> Add these allergens</> : <><CheckCircle2 className="h-4 w-4" /> Allergens added</>}
              </button>
            )}
            <p className="mt-2 text-[11px] text-stone-400">Typical recipe, not your exact dish — confirm before broadcasting.</p>
          </motion.div>
        )}
        {state.status === "empty" && (
          <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" className="text-xs text-stone-500">No USDA match for that name — try a simpler dish name in the title.</motion.p>
        )}
        {state.status === "error" && (
          <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">{state.msg}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Scan-first flow: photo → AI identifies items, quality and quantity → donor reviews the pre-filled form → ranked matches → broadcast. */
export function PostSurplusForm({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useNotWasted();
  const me = currentAccount(state);
  const { loading, evaluate } = useEvaluate();
  const [photo, setPhoto] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [manual, setManual] = useState(false);
  const [manualCategory, setManualCategory] = useState<Category>("furniture");
  const [scan, setScan] = useState<Evaluation | null>(null);
  const [title, setTitle] = useState("");
  const [attrs, setAttrs] = useState<ItemAttributes>({});
  const [itemsText, setItemsText] = useState("");
  const [safeAck, setSafeAck] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [qty, setQty] = useState<number | "">("");
  const [showPickup, setShowPickup] = useState(false);
  const [pickup, setPickup] = useState({
    institution: me?.orgName ?? "",
    department: me?.contactName ?? "",
    address: me?.address ?? "",
    transport: "" as Transport | "",
  });

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function applyEvaluation(ev: Evaluation) {
    setScan(ev);
    setTitle(ev.title);
    setAttrs(ev.attributes);
    setItemsText(itemList(ev.category, ev.attributes).join(", "));
    setSafeAck(false);
    if (ev.estimatedQty && ev.estimatedQty > 0) setQty(Math.round(ev.estimatedQty));
  }

  async function run(category: Category | "auto", file: File | null, text: string) {
    const ev = await evaluate(category, text, file);
    setProductImage(null);
    applyEvaluation(ev);
  }

  function pickProduct(p: Product) {
    setPhoto(null);
    setProductImage(p.imageUrl ?? null);
    applyEvaluation(productToEvaluation(p));
  }

  const set = (patch: ItemAttributes) => setAttrs((a) => ({ ...a, ...patch }));
  const key = scan ? itemKey(scan.category) : undefined;
  const attributes: ItemAttributes = key ? { ...attrs, [key]: splitList(itemsText) } : attrs;

  function onPhoto(f: File) {
    setPhoto(f);
    void run("auto", f, hint);
  }

  function changeCategory(c: Category) {
    void run(c, photo, hint || itemsText);
  }

  async function broadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!scan || !qty || !pickup.transport || (blocked && !safeAck)) return;
    const postedAt = Date.now();
    // Recipients see the donor's own photo; packaged-product images from Open Food Facts are not stored.
    const thumb = photo ? await photoThumbnail(photo) : undefined;
    dispatch({
      type: "BROADCAST",
      batch: {
        id: newId("bat"), category: scan.category, title, ...pickup, transport: pickup.transport, totalQty: qty, remainingQty: qty, status: "AVAILABLE",
        attributes, quality: scan.quality, postedAt, pickupBy: postedAt + scan.pickupWindowHours * 3600_000, aiSource: scan.source, photo: thumb,
      },
    });
    onDone();
  }

  const blocked = scan?.quality?.verdict === "Not suitable";
  const reset = () => { setScan(null); setPhoto(null); setProductImage(null); setQty(""); setHint(""); setAttrs({}); setItemsText(""); setSafeAck(false); };

  if (!scan) {
    return (
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-stone-500">Add a photo and AI identifies the items, their condition and quantity. You review everything before it goes out.</p>
        {!manual ? (
          <>
            <Dropzone file={photo} onFile={onPhoto} scanning={loading} title="Snap or drop a photo of the items" hint="AI identifies what it is, its condition and handling needs" />
            <input className={inputCls} placeholder="Optional hint, e.g. “12 office chairs from 3rd floor”" value={hint} onChange={(e) => setHint(e.target.value)} />
            <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-stone-400"><span className="h-px flex-1 bg-stone-200" /> or <span className="h-px flex-1 bg-stone-200" /></div>
            <button type="button" className={`${btn.secondary} min-h-12 w-full`} onClick={() => setManual(true)}><Keyboard className="h-4 w-4" /> No photo? Describe it instead</button>
            <BarcodeLookup onUse={pickProduct} />
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {CATEGORY_LIST.map((c) => {
                const Icon = CATEGORY_STYLE[c].icon;
                return (
                  <motion.button key={c} type="button" onClick={() => setManualCategory(c)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
                    className={`group flex flex-col items-center gap-1 rounded-2xl border p-3 text-xs font-semibold transition-colors ${manualCategory === c ? `border-transparent ring-2 ${CATEGORY_STYLE[c].chip}` : "border-stone-200 bg-white text-stone-600 hover:border-brand-200 hover:bg-brand-50/60"}`}>
                    <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" /> {CATEGORIES[c].label}
                  </motion.button>
                );
              })}
            </div>
            <textarea rows={3} className={inputCls} placeholder="What are you donating? e.g. winter coats, hoodies, t-shirts" value={hint} onChange={(e) => setHint(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" className={btn.ghost} onClick={() => setManual(false)}>Back to scan</button>
              <button type="button" className={`${btn.primary} flex-1`} disabled={!hint.trim() || loading} onClick={() => run(manualCategory, null, hint)}>
                <Sparkles className="h-4 w-4" /> {loading ? "Analyzing…" : "Analyze"}
              </button>
            </div>
            <BarcodeLookup onUse={pickProduct} />
          </motion.div>
        )}
      </div>
    );
  }

  const cfg = CATEGORIES[scan.category];
  const n = typeof qty === "number" ? qty : 0;

  return (
    <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={broadcast} className="space-y-6">
      {scan.quality && (() => {
        const q = QUALITY_STYLE[scan.quality.verdict] ?? QUALITY_STYLE["Check before pickup"];
        const Icon = q.icon;
        return (
          <div className={`flex items-start gap-2 rounded-2xl p-3 text-sm ring-1 ${q.cls}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div><span className="font-semibold">{scan.quality.verdict}</span>{scan.quality.notes && <span className="opacity-80"> · {scan.quality.notes}</span>}</div>
          </div>
        );
      })()}

      <div className="rounded-3xl bg-brand-50/40 p-5 ring-1 ring-brand-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CategoryChip category={scan.category} />
            <select aria-label="Change category" className="rounded-md border-0 bg-transparent text-xs text-stone-500" value={scan.category} onChange={(e) => changeCategory(e.target.value as Category)}>
              {CATEGORY_LIST.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
            </select>
          </div>
          {scan.dataSource ? <Badge tone="green"><Database className="h-3 w-3" /> {scan.dataSource}</Badge> : <AiSourceBadge source={scan.source} />}
        </div>
        <div className="mt-4 flex items-start gap-4">
          {preview && <img src={preview} alt="Uploaded donation" className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-stone-200" />}
          {!preview && productImage && <img src={productImage} alt={`${title} package`} className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain ring-1 ring-stone-200" />}
          <div className="min-w-0 flex-1">
            <input className="w-full bg-transparent font-display text-xl font-bold outline-none" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
            <p className="mt-1 text-sm text-stone-500">{scan.summary}</p>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-brand-700">
          {scan.dataSource ? <><Database className="h-3.5 w-3.5" /> Filled from {scan.dataSource}. Review and edit anything that looks off.</> : <><Sparkles className="h-3.5 w-3.5" /> AI-filled. Review and edit anything that looks off.</>}
        </p>
        <div className="mt-4 space-y-4">
          {key && <Field label="Items" hint="Comma-separated"><input className={inputCls} value={itemsText} onChange={(e) => setItemsText(e.target.value)} /></Field>}
          {scan.category === "food" && (
            <>
              <Chips label="Contains allergens" tone="red" options={ALLERGEN_OPTIONS} selected={attrs.allergens} onToggle={(v) => set({ allergens: toggle(attrs.allergens, v) })} />
              <UsdaCheck query={title.trim() || splitList(itemsText)[0] || ""} current={attrs.allergens} onAdd={(a) => setAttrs((p) => ({ ...p, allergens: mergeCi(p.allergens, a) }))} />
              <Chips label="Dietary" tone="green" options={DIETARY_OPTIONS} selected={attrs.dietary} onToggle={(v) => set({ dietary: toggle(attrs.dietary, v) })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Storage">
                  <select className={inputCls} value={attrs.storage ?? ""} onChange={(e) => set({ storage: (e.target.value || undefined) as StorageType | undefined })}>
                    <option value="">Not specified</option>
                    {STORAGE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Shelf life (hours)">
                  <input type="number" min={1} className={inputCls} value={attrs.shelfLifeHours ?? ""} onChange={(e) => set({ shelfLifeHours: e.target.value ? Math.max(1, +e.target.value) : undefined })} />
                </Field>
              </div>
              <p className="text-[11px] text-stone-400">Data: Open Food Facts · USDA FoodData Central</p>
            </>
          )}
          {scan.category !== "food" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Condition">
                <select className={inputCls} value={attrs.condition ?? ""} onChange={(e) => set({ condition: (e.target.value || undefined) as Condition | undefined })}>
                  <option value="">Not specified</option>
                  {CONDITION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              {scan.category === "clothing" && (
                <>
                  <Field label="Sizes"><input className={inputCls} placeholder="e.g. S–XL" value={attrs.sizeRange ?? ""} onChange={(e) => set({ sizeRange: e.target.value || undefined })} /></Field>
                  <Field label="Season"><input className={inputCls} placeholder="e.g. Winter" value={attrs.season ?? ""} onChange={(e) => set({ season: e.target.value || undefined })} /></Field>
                </>
              )}
              {scan.category === "furniture" && (
                <div className="flex flex-col justify-end gap-1.5 pb-1 text-sm text-stone-700">
                  <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-600" checked={!!attrs.needsTruck} onChange={(e) => set({ needsTruck: e.target.checked })} /> Needs a truck</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-600" checked={!!attrs.twoPersonLift} onChange={(e) => set({ twoPersonLift: e.target.checked })} /> 2-person lift</label>
                </div>
              )}
              {scan.category === "other" && <Field label="Notes"><input className={inputCls} value={attrs.notes ?? ""} onChange={(e) => set({ notes: e.target.value || undefined })} /></Field>}
            </div>
          )}
        </div>
      </div>

      <Field label={`How many ${cfg.unit}?`} hint={scan.estimatedQty ? `AI counted about ${scan.estimatedQty} in the photo` : undefined}>
        <input autoFocus type="number" min={1} required className={`${inputCls} !py-3 text-2xl font-bold`} placeholder="0" value={qty} onChange={(e) => setQty(e.target.value ? Math.max(1, +e.target.value) : "")} />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-stone-700">Who moves it?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([["Donor delivers", "We'll deliver it", Truck], ["Recipient picks up", "A food bank picks it up", Handshake]] as const).map(([value, label, Icon]) => (
            <button key={value} type="button" role="radio" aria-checked={pickup.transport === value} onClick={() => setPickup({ ...pickup, transport: value })}
              className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium ring-1 transition hover:-translate-y-px ${pickup.transport === value ? "bg-brand-600 text-white ring-brand-600 shadow-card" : "bg-white text-stone-700 ring-stone-200 hover:bg-brand-50 hover:ring-brand-200"}`}>
              <Icon className="h-4 w-4 shrink-0" /> {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <button type="button" onClick={() => setShowPickup(!showPickup)} aria-expanded={showPickup} className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-sm font-medium text-stone-600 transition hover:text-brand-700">
          Pickup location: {pickup.address || pickup.institution}
          <motion.span animate={{ rotate: showPickup ? 180 : 0 }}><ChevronDown className="h-4 w-4" /></motion.span>
        </button>
        <AnimatePresence initial={false}>
          {showPickup && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="overflow-hidden">
              <div className="grid grid-cols-2 gap-4 pt-4">
                <Field label="Institution"><input className={inputCls} value={pickup.institution} onChange={(e) => setPickup({ ...pickup, institution: e.target.value })} /></Field>
                <Field label="Department"><input className={inputCls} value={pickup.department} onChange={(e) => setPickup({ ...pickup, department: e.target.value })} /></Field>
                <div className="col-span-2"><Field label="Address"><input className={inputCls} value={pickup.address} onChange={(e) => setPickup({ ...pickup, address: e.target.value })} /></Field></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {blocked && (
        <label className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          <input type="checkbox" className="mt-0.5 accent-red-600" checked={safeAck} onChange={(e) => setSafeAck(e.target.checked)} />
          I&apos;ve checked these items and they&apos;re safe to donate
        </label>
      )}

      <div className="flex gap-2">
        <button type="button" className={btn.ghost} onClick={reset}><RotateCcw className="h-4 w-4" /> Rescan</button>
        <button type="submit" disabled={!n || loading || !pickup.transport || (blocked && !safeAck)} className={`${btn.primary} flex-1`}><Radio className="h-4 w-4" /> Post donation</button>
      </div>
    </motion.form>
  );
}
