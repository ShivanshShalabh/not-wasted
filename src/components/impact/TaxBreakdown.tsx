"use client";

import { Info } from "lucide-react";
import { useNotWasted } from "@/context/NotWastedContext";
import { COST_BASIS_SHARE, deductionLines } from "@/lib/impact";
import { Modal } from "../ui";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** "How was this calculated?" for a donor's estimated deduction: formula, assumptions and each donation. */
export function TaxBreakdown({ donor, open, onClose }: { donor: string; open: boolean; onClose: () => void }) {
  const { state } = useNotWasted();
  const lines = deductionLines(state, donor);
  const total = lines.reduce((a, l) => a + l.deduction, 0);
  const fmv = lines.reduce((a, l) => a + l.fmv, 0);

  return (
    <Modal open={open} onClose={onClose} wide title="How your tax deduction was estimated">
      <div className="space-y-6 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          {[["Fair-market value", usd(fmv)], ["Assumed cost basis", usd(fmv * COST_BASIS_SHARE)], ["Estimated deduction", usd(total)]].map(([k, v], i) => (
            <div key={k} className={`rounded-2xl p-4 ring-1 ${i === 2 ? "bg-brand-600 text-white ring-brand-600" : "bg-brand-50/60 ring-brand-100"}`}>
              <div className={`text-xs font-medium ${i === 2 ? "text-white/80" : "text-stone-500"}`}>{k}</div>
              <div className="mt-1 font-display text-2xl font-bold tabular">{v}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-paper p-4 ring-1 ring-stone-200">
          <div className="font-semibold text-ink">The formula</div>
          <ul className="mt-2 space-y-1.5 text-stone-700">
            <li><b>Food</b> — IRS §170(e)(3) enhanced deduction: <span className="font-mono text-[13px]">min(basis + ½ × (FMV − basis), 2 × basis)</span>, never above FMV.</li>
            <li><b>Furniture, clothing, other goods</b> — fair-market value.</li>
            <li><b>FMV per unit</b> — meal packet $8, furniture piece $45, clothing item $6, other item $10.</li>
          </ul>
        </div>

        <div className="overflow-x-auto rounded-2xl ring-1 ring-brand-100">
          <table className="w-full text-left">
            <thead className="bg-brand-50/70 text-stone-600">
              <tr>{["Donation", "Received by", "Qty", "FMV", "Basis", "Method", "Deduction"].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.claimId} className="border-t border-brand-100/70 text-stone-700">
                  <td className="px-3 py-2.5 font-medium text-ink">{l.title}</td>
                  <td className="px-3 py-2.5">{l.recipient}</td>
                  <td className="tabular px-3 py-2.5">{l.qty} <span className="text-stone-500">× {usd(l.unitFmv)}</span></td>
                  <td className="tabular px-3 py-2.5">{usd(l.fmv)}</td>
                  <td className="tabular px-3 py-2.5">{usd(l.basis)}</td>
                  <td className="px-3 py-2.5 text-xs">{l.method}</td>
                  <td className="tabular px-3 py-2.5 font-semibold text-brand-700">{usd(l.deduction)}</td>
                </tr>
              ))}
              {!lines.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-stone-500">No claimed donations yet.</td></tr>}
            </tbody>
            {lines.length > 0 && (
              <tfoot><tr className="border-t-2 border-brand-200 font-semibold text-ink"><td className="px-3 py-2.5" colSpan={6}>Total</td><td className="tabular px-3 py-2.5 text-brand-700">{usd(total)}</td></tr></tfoot>
            )}
          </table>
        </div>

        <p className="flex gap-2 rounded-2xl bg-amber-50 p-3.5 text-amber-900 ring-1 ring-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Illustrative estimate. The cost basis assumes the donor paid {Math.round(COST_BASIS_SHARE * 100)}% of fair-market value — replace it with your actual invoice costs. Tax-exempt donors (such as most universities) can&apos;t claim a deduction. Not tax advice; confirm with your tax advisor.</span>
        </p>
      </div>
    </Modal>
  );
}
