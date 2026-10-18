"use client";

import { BadgeCheck, Plus } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/categories";
import { newId } from "@/lib/inventory";
import type { Category, NotifyChannel } from "@/lib/types";
import { btn, Card, CategoryChip, Field, inputCls, Modal, SectionTitle } from "../ui";

export function RecipientDirectory() {
  const { state } = useNotWasted();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <SectionTitle hint="Food banks, shelters and community groups that receive donations"
        action={<button className={btn.secondary} onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Register organization</button>}>
        <span className="tabular">{state.recipients.length}</span> verified organizations
      </SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-brand-100 text-left text-sm text-stone-500"><th className="pb-3 pr-4 font-medium">Organization</th><th className="pb-3 pr-4 font-medium">Distance</th><th className="pb-3 pr-4 font-medium">Accepts</th><th className="pb-3 font-medium">Free space</th></tr></thead>
          <tbody className="divide-y divide-brand-100/60">
            {state.recipients.map((r) => (
              <tr key={r.id} className="transition-colors duration-300 hover:bg-brand-50/50">
                <td className="py-3.5 pr-4 font-medium"><span className="flex items-center gap-1.5">{r.verified && <BadgeCheck className="h-4 w-4 text-brand-600" />}{r.name}</span><span className="mt-0.5 block text-xs font-normal text-stone-500">{r.type}</span></td>
                <td className="pr-4 tabular text-stone-600">{r.distanceMi} mi</td>
                <td className="pr-4"><div className="flex flex-wrap gap-1">{r.acceptedCategories.map((c) => <CategoryChip key={c} category={c} />)}</div></td>
                <td className="text-sm tabular text-stone-600">{r.acceptedCategories.map((c) => `${r.capacity[c] ?? 0} ${CATEGORIES[c].unit}`).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RegisterModal open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function RegisterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useNotWasted();
  const [f, setF] = useState({ name: "", type: "Food Pantry", address: "", distanceMi: 2, notifyChannel: "Email" as NotifyChannel, contact: "", needs: "", hasTruck: false, coldStorage: false });
  const [cap, setCap] = useState<Partial<Record<Category, number>>>({ food: 50 });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const accepted = CATEGORY_LIST.filter((c) => (cap[c] ?? 0) > 0);
    if (!accepted.length) return;
    dispatch({
      type: "REGISTER_RECIPIENT",
      recipient: {
        id: newId("rcp"), ...f, x: 10 + Math.random() * 75, y: 10 + Math.random() * 60,
        acceptedCategories: accepted, capacity: Object.fromEntries(accepted.map((c) => [c, cap[c]])), verified: true,
        needs: f.needs.split(",").map((s) => s.trim()).filter(Boolean), hasTruck: f.hasTruck, coldStorage: f.coldStorage,
      },
    });
    onClose();
    setF({ ...f, name: "", address: "", contact: "" });
  }

  return (
    <Modal open={open} onClose={onClose} title="Register a recipient organization">
      <form onSubmit={submit} className="grid grid-cols-2 gap-x-4 gap-y-5">
        <div className="col-span-2"><Field label="Organization name"><input required className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
        <Field label="Type">
          <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option>Food Pantry</option><option>Food Bank</option><option>Soup Kitchen</option><option>Shelter</option><option>Furniture Bank</option><option>Clothing Closet</option><option>Community Center</option>
          </select>
        </Field>
        <Field label="Distance (mi)"><input type="number" step="0.1" min={0} className={inputCls} value={f.distanceMi} onChange={(e) => setF({ ...f, distanceMi: +e.target.value })} /></Field>
        <div className="col-span-2"><Field label="Address"><input required className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field></div>
        <Field label="Notify via">
          <select className={inputCls} value={f.notifyChannel} onChange={(e) => setF({ ...f, notifyChannel: e.target.value as NotifyChannel })}><option>Email</option><option>SMS</option></select>
        </Field>
        <Field label={f.notifyChannel === "SMS" ? "Phone" : "Email"}><input required className={inputCls} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
        <div className="col-span-2"><Field label="What you need most (comma separated)" hint="Used to match you with the right donations"><input className={inputCls} placeholder="hot meals, coats, chairs" value={f.needs} onChange={(e) => setF({ ...f, needs: e.target.value })} /></Field></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={f.hasTruck} onChange={(e) => setF({ ...f, hasTruck: e.target.checked })} /> We have a truck</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={f.coldStorage} onChange={(e) => setF({ ...f, coldStorage: e.target.checked })} /> We have cold storage</label>
        <div className="col-span-2">
          <div className="mb-2 text-sm font-medium text-stone-700">Accepted categories and free capacity <span className="font-normal text-stone-400">(0 = not accepted)</span></div>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_LIST.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <span className="w-24">{CATEGORIES[c].label}</span>
                <input type="number" min={0} className={inputCls} value={cap[c] ?? 0} onChange={(e) => setCap({ ...cap, [c]: Math.max(0, +e.target.value) })} />
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className={`${btn.primary} col-span-2`}>Verify and add to network</button>
      </form>
    </Modal>
  );
}
