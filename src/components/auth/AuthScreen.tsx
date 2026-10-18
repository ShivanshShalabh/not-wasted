"use client";

import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from "framer-motion";
import { Apple, Armchair, ArrowLeft, ArrowRight, Clock, Leaf, Shirt, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brand } from "../Brand";
import { LandingStory } from "../landing/LandingStory";
import { btn } from "../ui";
import { RegisterWizard } from "./RegisterWizard";
import { SignIn } from "./SignIn";

type Mode = "hero" | "signin" | "register";

const spring = { type: "spring" as const, stiffness: 220, damping: 26 };
const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { ...spring, delay: 0.08 + i * 0.09 } }),
};

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("hero");
  const panel = useRef<HTMLDivElement>(null);

  // Stacked layout: bring the form into view when a CTA is chosen.
  useEffect(() => {
    if (mode !== "hero" && window.innerWidth < 1024) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mode]);

  // Story CTAs jump back to the top, where the form opens.
  const start = (m: Mode) => { setMode(m); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <>
    <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-5 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between py-6">
        <button onClick={() => setMode("hero")} aria-label="Not Wasted home" className="rounded-2xl">
          <Brand />
        </button>
        <AnimatePresence>
          {mode !== "hero" && (
            <motion.button initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
              onClick={() => setMode("hero")} className={`${btn.ghost} min-h-11`}>
              <ArrowLeft className="h-4 w-4" /> Back
            </motion.button>
          )}
        </AnimatePresence>
      </header>

      <main className="grid flex-1 items-center gap-12 pb-16 pt-4 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pt-0">
        <HeroCopy mode={mode} setMode={setMode} />

        <div ref={panel} className="relative scroll-mt-4">
          <AnimatePresence mode="wait" initial={false}>
            {mode === "hero" ? (
              <motion.div key="preview" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24, scale: 0.98 }} transition={spring}>
                <PreviewGrid />
              </motion.div>
            ) : (
              <motion.div key={mode} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.98 }} transition={spring}
                className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lift ring-1 ring-brand-900/[0.05] backdrop-blur-xl sm:p-9">
                {mode === "signin" ? <SignIn onRegister={() => setMode("register")} /> : <RegisterWizard onSignIn={() => setMode("signin")} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
    {mode === "hero" && <LandingStory onStart={() => start("signin")} onRegister={() => start("register")} />}
    </>
  );
}

const PARTNERS = [
  { i: "SH", c: "bg-brand-100 text-brand-700" },
  { i: "SL", c: "bg-sage-100 text-sage-700" },
  { i: "VU", c: "bg-amber-100 text-amber-800" },
];

function HeroCopy({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <motion.div initial="hidden" animate="show" className="max-w-xl">
      <motion.div variants={rise} custom={0}
        className="inline-flex items-center gap-2.5 rounded-full border border-white/80 bg-white/70 py-1.5 pl-1.5 pr-4 text-sm text-stone-700 shadow-sm backdrop-blur">
        <span className="flex -space-x-1.5">
          {PARTNERS.map(({ i, c }) => (
            <span key={i} className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] tracking-tight font-bold ring-2 ring-white ${c}`}>{i}</span>
          ))}
        </span>
        <Leaf className="h-4 w-4 text-sage-700" aria-hidden />
        <span><b className="font-semibold text-ink">5</b> <span className="hidden sm:inline">community</span> partners <span aria-hidden className="mx-1 text-stone-400">•</span> 1 university</span>
      </motion.div>

      <h1 className="mt-8 font-display text-[3.25rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
        <motion.span variants={rise} custom={1} className="block text-ink">Surplus saved,</motion.span>
        <motion.span variants={rise} custom={2} className="block text-brand-600">neighbors fed.</motion.span>
      </h1>

      <motion.p variants={rise} custom={3} className="mt-6 max-w-lg text-lg leading-relaxed text-stone-600">
        Food, furniture and clothing left over from Nashville&apos;s campuses, hospitals and venues — matched to verified food banks and shelters in minutes.
      </motion.p>

      <motion.div variants={rise} custom={4} className="mt-9 flex flex-wrap gap-3">
        <button onClick={() => setMode("signin")} aria-pressed={mode === "signin"}
          className={`${btn.primary} min-h-12 w-full px-7 text-base sm:w-auto ${mode === "signin" ? "ring-4 ring-brand-200" : ""}`}>
          Log in <ArrowRight className="h-4 w-4" />
        </button>
        <button onClick={() => setMode("register")} aria-pressed={mode === "register"}
          className={`${btn.secondary} min-h-12 w-full px-7 text-base sm:w-auto ${mode === "register" ? "border-brand-600 bg-brand-50" : ""}`}>
          Register your organization
        </button>
      </motion.div>

      <motion.p variants={rise} custom={5} className="mt-6 flex items-center gap-2 text-sm text-stone-600">
        <Sparkles className="h-4 w-4 text-brand-600" aria-hidden /> Organizations only · free for donors and nonprofits
      </motion.p>
    </motion.div>
  );
}

type Preview = { icon: typeof Apple; tile: string; title: string; meta: string; body: ReactNode; h: string };

const PREVIEWS: Preview[][] = [
  [
    { icon: Apple, tile: "bg-sage-100 text-sage-700", title: "Hot pasta & salad", meta: "Rand Dining Hall", h: "min-h-48",
      body: <><Stat k="50" v="meals" /><Pill><Clock className="h-3 w-3" /> 2h 34m left</Pill></> },
    { icon: Shirt, tile: "bg-sky-100 text-sky-800", title: "Winter coats", meta: "Hope Threads", h: "min-h-60",
      body: <><Stat k="200" v="items" /><Bar pct={64} /><span className="text-xs text-stone-600">128 claimed · 72 left</span></> },
  ],
  [
    { icon: Armchair, tile: "bg-amber-100 text-amber-800", title: "Office chairs", meta: "Vanderbilt facilities", h: "min-h-56",
      body: <><Stat k="25" v="pieces" /><Pill tone="brand">Pickup by Fri</Pill></> },
    // What a food bank sees: a new donation ranked against its needs.
    { icon: Sparkles, tile: "bg-brand-100 text-brand-700", title: "Matched for you", meta: "Produce boxes · Belmont Dining", h: "min-h-48",
      body: <><Stat k="91%" v="fit" /><Bar pct={91} tone="bg-brand-500" /><span className="text-xs text-stone-600">Fits your fridge space · 2 mi</span></> },
  ],
];

function PreviewGrid() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="relative mx-auto max-w-2xl pb-28">
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        {PREVIEWS.map((col, ci) => (
          <div key={ci} className={`flex flex-col gap-4 sm:gap-5 ${ci === 1 ? "mt-10" : ""}`}>
            {col.map((p, i) => (
              <PreviewCard key={p.title} p={p} index={ci * 2 + i} reduce={!!reduce} />
            ))}
          </div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.75 }}
        className="absolute inset-x-6 bottom-0 grid grid-cols-3 rounded-3xl bg-white px-4 py-5 shadow-lift ring-1 ring-brand-900/[0.05] sm:inset-x-12">
        <CountStat to={45} suffix=" min" label="Event-end ping" />
        <CountStat to={4} label="Surplus categories" />
        <CountStat to={100} suffix="%" label="Verified orgs" />
      </motion.div>
    </div>
  );
}

function PreviewCard({ p, index, reduce }: { p: Preview; index: number; reduce: boolean }) {
  const Icon = p.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 40, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring, delay: 0.35 + index * 0.1 }}>
      <div className={reduce ? "" : "animate-float"} style={{ animationDelay: `${-index * 1.7}s` }}>
        <motion.div whileHover={reduce ? undefined : { y: -8, rotate: index % 2 ? 1.5 : -1.5, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`flex ${p.h} flex-col rounded-3xl border border-white/80 bg-white/75 p-5 shadow-card ring-1 ring-brand-900/[0.04] backdrop-blur-xl transition-shadow duration-300 hover:shadow-lift`}>
          <div className="flex flex-col items-start gap-3 sm:flex-row">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${p.tile}`}><Icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <div className="font-semibold leading-snug text-ink sm:truncate">{p.title}</div>
              <div className="text-xs text-stone-600 sm:truncate">{p.meta}</div>
            </div>
          </div>
          <div className="mt-auto flex flex-col items-start gap-2.5 pt-6">{p.body}</div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="flex items-baseline gap-1.5"><span className="font-display text-3xl font-semibold text-ink">{k}</span><span className="text-sm text-stone-600">{v}</span></div>;
}
function Pill({ children, tone = "sage" }: { children: ReactNode; tone?: "sage" | "brand" }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tone === "sage" ? "bg-sage-100 text-sage-700" : "bg-brand-50 text-brand-700"}`}>{children}</span>;
}
function Bar({ pct, tone = "bg-sage-500" }: { pct: number; tone?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200/80">
      <motion.div className={`h-full rounded-full ${tone}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, delay: 0.9, ease: "easeOut" }} />
    </div>
  );
}

function CountStat({ to, suffix = "", label }: { to: number; suffix?: string; label: string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (n) => `${Math.round(n)}${suffix}`);
  useEffect(() => {
    const c = animate(mv, to, { duration: 1.4, delay: 0.9, ease: "easeOut" });
    return c.stop;
  }, [mv, to]);
  return (
    <div className="text-center">
      <motion.div className="font-display text-2xl font-semibold text-brand-600 sm:text-3xl">{text}</motion.div>
      <div className="mt-0.5 text-xs text-stone-600 sm:text-sm">{label}</div>
    </div>
  );
}
