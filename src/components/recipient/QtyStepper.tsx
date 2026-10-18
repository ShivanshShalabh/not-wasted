"use client";

import { Minus, Plus } from "lucide-react";

/** −/+ stepper with a typed input. Keeps the raw text so people can clear and retype; parent validates. */
export function QtyStepper({ id, value, onChange, min = 0, max, step = 1, label, invalid }: {
  id?: string; value: string; onChange: (v: string) => void; min?: number; max?: number; step?: number; label: string; invalid?: boolean;
}) {
  const n = Math.floor(Number(value));
  const cur = Number.isFinite(n) ? n : min;
  const clamp = (v: number) => Math.max(min, max != null ? Math.min(max, v) : v);
  return (
    <div className={`inline-flex items-center rounded-full bg-white ring-1 transition ${invalid ? "ring-red-400" : "ring-stone-300 focus-within:ring-brand-500"}`}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={cur <= min} onClick={() => onChange(String(clamp(cur - step)))}
        className="flex h-11 w-11 items-center justify-center rounded-full text-stone-500 transition hover:bg-brand-50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30">
        <Minus className="h-4 w-4" />
      </button>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} value={value} aria-label={label} aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="tabular w-16 bg-transparent text-center text-base font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      <button type="button" aria-label={`Increase ${label}`} disabled={max != null && cur >= max} onClick={() => onChange(String(clamp(cur + step)))}
        className="flex h-11 w-11 items-center justify-center rounded-full text-stone-500 transition hover:bg-brand-50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Whole number check for typed quantities. Returns an error message or null. */
export function qtyError(raw: string, min: number, max?: number, unit = ""): string | null {
  if (raw.trim() === "") return "Enter a number.";
  const v = Number(raw);
  if (!Number.isInteger(v)) return "Use a whole number.";
  if (v < min) return `Must be ${min} or more.`;
  if (max != null && v > max) return `Up to ${max}${unit ? ` ${unit}` : ""}.`;
  return null;
}
