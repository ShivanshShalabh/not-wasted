"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { QualityCheck } from "@/lib/types";
import { btn, Modal } from "../ui";

/** The AI quality check flagged the items: ask the donor to confirm before anything is posted. */
export const needsQualityConfirm = (q?: QualityCheck) => !!q && q.verdict !== "Good to donate";

export function QualityConfirm({ quality, open, onCancel, onConfirm }: { quality?: QualityCheck; open: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!quality) return null;
  const severe = quality.verdict === "Not suitable";
  const Icon = severe ? ShieldAlert : AlertTriangle;
  return (
    <Modal open={open} onClose={onCancel} title={<span className="flex items-center gap-2"><Icon className={`h-5 w-5 ${severe ? "text-red-600" : "text-amber-600"}`} /> Are you sure this is OK to donate?</span>}>
      <div role="alertdialog" aria-describedby="quality-confirm-body" className="space-y-5">
        <div id="quality-confirm-body" className={`rounded-2xl p-4 text-sm leading-relaxed ring-1 ${severe ? "bg-red-50 text-red-900 ring-red-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
          <p className="font-semibold">Our quality check says: {quality.verdict.toLowerCase()}.</p>
          {quality.notes && <p className="mt-1">{quality.notes}</p>}
        </div>
        <div className="text-sm text-stone-700">
          <p className="font-medium">Before you post, please check that the items are:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600">
            <li>not spoiled, moldy, expired or past a safe holding time</li>
            <li>sealed or covered, and stored at a safe temperature</li>
            <li>clean and undamaged (for furniture and clothing)</li>
          </ul>
          <p className="mt-3 text-stone-500">Food banks will see this quality note on the listing.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" autoFocus className={btn.secondary} onClick={onCancel}>No, go back</button>
          <button type="button" className={severe ? btn.danger : btn.primary} onClick={onConfirm}>Yes, it&apos;s safe to donate</button>
        </div>
      </div>
    </Modal>
  );
}
