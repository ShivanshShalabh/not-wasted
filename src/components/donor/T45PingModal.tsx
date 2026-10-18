"use client";

import { AlarmClock, Radio, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { countdown, photoThumbnail } from "@/lib/format";
import { newId } from "@/lib/inventory";
import type { DonorEvent } from "@/lib/types";
import { AttributeTags, itemList } from "../AttributeTags";
import { PhotoPicker } from "../PhotoPicker";
import { AiSourceBadge, btn, Field, inputCls, Modal } from "../ui";
import { useEvaluate } from "../useEvaluate";

export function T45PingModal({ event }: { event: DonorEvent }) {
  const { state, dispatch, now } = useNotWasted();
  const [qty, setQty] = useState(100);
  const [description, setDescription] = useState(event.mealDescription);
  const [photo, setPhoto] = useState<File | null>(null);
  const { result, loading, evaluate } = useEvaluate();
  const close = () => dispatch({ type: "CLOSE_PING" });

  async function broadcast() {
    const ev = result ?? (await evaluate("food", description, photo));
    const postedAt = Date.now();
    dispatch({
      type: "BROADCAST",
      batch: {
        id: newId("bat"), category: "food", title: ev.title, institution: event.institution, department: event.department,
        address: event.address, eventId: event.id, totalQty: qty, remainingQty: qty, status: "AVAILABLE",
        attributes: { storage: event.storage, ...ev.attributes }, transport: event.transport, postedAt,
        pickupBy: Math.max(event.end, postedAt) + ev.pickupWindowHours * 3600_000, aiSource: ev.source,
        photo: photo ? await photoThumbnail(photo) : undefined,
      },
    });
  }

  return (
    <Modal open onClose={close} wide title={
      <span className="flex items-center gap-2 text-amber-700"><AlarmClock className="h-5 w-5 animate-pulse" /> 45 minutes left — how much food is left over?</span>
    }>
      <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
        <b className="text-ink">{event.name}</b> ends in <span className="tabular">{countdown(Math.max(0, event.end - now))}</span>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="How many meals are left?">
            <input type="number" min={1} className={`${inputCls} text-2xl font-bold`} value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value))} />
          </Field>
          <Field label="What's left (helps AI tag allergens)">
            <textarea rows={2} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <PhotoPicker file={photo} onChange={setPhoto} />
          <button className={btn.secondary} disabled={loading} onClick={() => evaluate("food", description, photo)}>
            <Sparkles className="h-4 w-4" /> {loading ? "Checking…" : "Check with AI"}
          </button>
        </div>
        <div className="rounded-3xl bg-brand-50/40 p-5 ring-1 ring-brand-100">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold">AI food check {result && <AiSourceBadge source={result.source} />}</div>
          {result ? (
            <div className="space-y-3 text-sm">
              <div className="font-medium">{result.title}</div>
              <ul className="list-inside list-disc text-stone-600">{itemList("food", result.attributes).map((i) => <li key={i}>{i}</li>)}</ul>
              <AttributeTags category="food" a={result.attributes} />
              <p className="text-xs text-stone-500">{result.summary}</p>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-stone-500">Optional: add a photo or description and press “Check with AI” to tag allergens, storage and the pickup window.</p>
          )}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-5">
        <div className="text-sm text-stone-500">{event.transport === "Donor delivers" ? "You'll deliver it" : "A food bank will pick it up"}</div>
        <button className={btn.primary} disabled={loading} onClick={broadcast}>
          <Radio className="h-4 w-4" /> Share {qty} leftover meals
        </button>
      </div>
    </Modal>
  );
}
