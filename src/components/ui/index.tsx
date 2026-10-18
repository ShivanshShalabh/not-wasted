"use client";

import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Check, Lightbulb, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Apple, Armchair, Package, Shirt } from "lucide-react";
import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";

export const CATEGORY_STYLE: Record<Category, { chip: string; bar: string; icon: typeof Apple }> = {
  food: { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", bar: "bg-emerald-500", icon: Apple },
  furniture: { chip: "bg-amber-50 text-amber-800 ring-amber-200", bar: "bg-amber-500", icon: Armchair },
  clothing: { chip: "bg-sky-50 text-sky-800 ring-sky-200", bar: "bg-sky-500", icon: Shirt },
  other: { chip: "bg-violet-50 text-violet-800 ring-violet-200", bar: "bg-violet-500", icon: Package },
};

export function CategoryChip({ category }: { category: Category }) {
  const s = CATEGORY_STYLE[category];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${s.chip}`}>
      <Icon className="h-3 w-3" /> {CATEGORIES[category].label}
    </span>
  );
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "amber" | "red" | "blue" }) {
  const tones = {
    gray: "bg-stone-100 text-stone-700 ring-stone-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-sky-50 text-sky-800 ring-sky-200",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tones[tone]}`}>{children}</span>;
}

/** Availability bar: green above 50% left, amber below, gray when gone. */
export function AvailabilityBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total ? (remaining / total) * 100 : 0;
  const color = remaining === 0 ? "bg-stone-300" : pct > 50 ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
      <motion.div className={`h-full rounded-full ${color}`} initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
    </div>
  );
}

const SEGMENT_COLORS = ["bg-brand-600", "bg-sage-500", "bg-brand-200", "bg-sage-700", "bg-brand-500", "bg-stone-400"];

export function SegmentedBar({ segments, total }: { segments: { label: string; qty: number }[]; total: number }) {
  return (
    <div className="flex h-4 w-full overflow-hidden rounded-full bg-stone-200">
      {segments.map((s, i) => (
        <motion.div
          key={s.label + i}
          title={`${s.label}: ${s.qty}`}
          className={`h-full ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} border-r border-white/60 last:border-r-0`}
          initial={{ width: 0 }}
          animate={{ width: `${(s.qty / total) * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay: i * 0.05 }}
        />
      ))}
    </div>
  );
}
export const segmentColor = (i: number) => SEGMENT_COLORS[i % SEGMENT_COLORS.length];

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`mt-10 w-full ${wide ? "max-w-3xl" : "max-w-xl"} rounded-3xl bg-white shadow-2xl ring-1 ring-brand-900/5`}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-4">
              <div className="text-lg font-semibold">{title}</div>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-stone-500 hover:bg-stone-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Number that springs to its new value — used for live remaining counts and KPIs. */
export function AnimatedNumber({ value, from, duration = 0.6, format = (n: number) => Math.round(n).toLocaleString() }: { value: number; from?: number; duration?: number; format?: (n: number) => string }) {
  // `from` makes the number count up on first render (e.g. headline stats on page load).
  const mv = useMotionValue(from ?? value);
  const text = useTransform(mv, format);
  useEffect(() => {
    const c = animate(mv, value, { duration, ease: "easeOut" });
    return c.stop;
  }, [mv, value, duration]);
  return <motion.span>{text}</motion.span>;
}

/** Segmented tabs with a sliding pill. `id` must be unique per tab group on the page. */
export function Tabs<T extends string>({ id, value, onChange, items, size = "md" }: {
  id: string; value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; size?: "md" | "lg";
}) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-white/70 bg-white/60 p-1 shadow-sm backdrop-blur">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={`relative inline-flex cursor-pointer items-center gap-1.5 rounded-full font-medium transition-colors ${size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-sm"} ${value === it.value ? "text-ink" : "text-stone-500 hover:text-ink"}`}
        >
          {value === it.value && (
            <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-full bg-white shadow-[0_4px_12px_-4px_rgb(61_26_12/0.18)] ring-1 ring-brand-100" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
          )}
          <span className="relative z-10 inline-flex items-center gap-1.5">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, type: "spring" as const, stiffness: 260, damping: 26 } }),
};

export function MotionList({ children, className = "" }: { children: ReactNode[]; className?: string }) {
  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        {children.map((child, i) => (
          <motion.div key={(child as { key?: string }).key ?? i} layout className="min-w-0" variants={fadeUp} custom={i} initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.97 }}>
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Card({ children, className = "", interactive }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return (
    <div className={`rounded-3xl border border-white/70 bg-white/85 p-6 shadow-card ring-1 ring-brand-900/[0.04] backdrop-blur-xl ${interactive ? "transition duration-500 ease-out hover:-translate-y-1 hover:shadow-lift hover:ring-brand-200" : ""} ${className}`}>
      {children}
    </div>
  );
}

/** One header shape for every page: optional eyebrow, display title, one-line description, actions on the right. */
export function PageHeader({ eyebrow, title, accent, description, actions }: { eyebrow?: ReactNode; title: ReactNode; accent?: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-white/70 px-3 py-1 text-xs font-medium text-brand-700 shadow-sm backdrop-blur">{eyebrow}</div>
        )}
        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
          {title}
          {accent && (
            <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, type: "spring", stiffness: 200, damping: 24 }}
              className="block text-brand-500">{accent}</motion.span>
          )}
        </h1>
        {description && <p className="mt-4 text-base leading-relaxed text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

/** Small section heading used inside pages to group related content. */
export function SectionTitle({ children, hint, action }: { children: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
        {hint && <p className="mt-0.5 text-sm text-stone-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center rounded-3xl border border-dashed border-brand-200 bg-white/60 px-6 py-16 text-center backdrop-blur">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-stone-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/**
 * Dismissible "how this works" strip for first-time users. Remembers dismissal per id in
 * localStorage (best effort; it simply shows again if storage is unavailable).
 */
export function GettingStarted({ id, title, steps }: { id: string; title: string; steps: { title: string; body: string }[] }) {
  const key = `nw-guide-${id}`;
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(key) !== "done"; } catch { return true; }
  });
  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(key, "done"); } catch { /* ignore */ }
  };
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
          <div className="relative overflow-hidden rounded-3xl bg-brand-900 p-7 text-white shadow-lift">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sage-500/30 blur-3xl" />
            <button onClick={dismiss} aria-label="Dismiss guide" className="absolute right-4 top-4 rounded-lg p-1 text-white/60 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-brand-100"><Lightbulb className="h-4 w-4" /> {title}</div>
            <ol className="grid gap-5 md:grid-cols-3">
              {steps.map((s, i) => (
                <motion.li key={s.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold tabular">{i + 1}</span>
                  <div>
                    <div className="font-semibold">{s.title}</div>
                    <p className="mt-0.5 text-sm leading-relaxed text-white/70">{s.body}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
            <button onClick={dismiss} className="mt-6 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand-900 shadow-[0_8px_20px_-8px_rgb(0_0_0/0.5)] transition duration-300 hover:-translate-y-0.5 hover:bg-brand-50 active:scale-[0.97]">
              <Check className="h-4 w-4" /> Got it
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-400">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-2xl border border-stone-200 bg-white/90 px-4 py-2.5 text-sm outline-none transition placeholder:text-stone-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

const press = "cursor-pointer transition duration-300 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 [&_svg]:transition-transform [&_svg]:duration-300";
export const btn = {
  primary: `group inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgb(191_83_32/0.6)] hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_14px_28px_-10px_rgb(191_83_32/0.7)] hover:[&_svg:last-child]:translate-x-0.5 disabled:hover:translate-y-0 ${press}`,
  secondary: `group inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-brand-600/70 bg-white/70 px-5 py-2.5 text-sm font-semibold text-brand-700 backdrop-blur hover:-translate-y-0.5 hover:border-brand-600 hover:bg-brand-50 disabled:hover:translate-y-0 ${press}`,
  ghost: `inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-stone-600 hover:bg-brand-50 hover:text-brand-700 ${press}`,
  danger: `inline-flex items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 ${press}`,
};

export function AiSourceBadge({ source }: { source: "oci" | "local" }) {
  return source === "oci" ? <Badge tone="blue">OCI Generative AI</Badge> : <Badge>Local AI fallback</Badge>;
}
