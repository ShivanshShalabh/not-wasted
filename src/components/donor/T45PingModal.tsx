"use client";

import { AlarmClock, Radio, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { MIN_FOOD_QTY } from "@/lib/categories";
import { countdown, photoThumbnail } from "@/lib/format";
import { newId } from "@/lib/inventory";
import type { DonorEvent } from "@/lib/types";
import { ALLERGEN_OPTIONS, AttributeTags, DIETARY_OPTIONS, itemList, knownTags, mergeTags, TagChips, toggleTag } from "../AttributeTags";
import { PhotoPicker } from "../PhotoPicker";
import { AiSourceBadge, btn, Field, inputCls, Modal } from "../ui";
import { type Evaluation, useEvaluate } from "../useEvaluate";
import { needsQualityConfirm, QualityConfirm } from "./QualityConfirm";

export function T45PingModal({ event }: { event: DonorEvent }) {
  const { state, dispatch, now } = useNotWasted();
  const [qty, setQty] = useState(100);
  const [description, setDescription] = useState(event.mealDescription);
  const [photo, setPhoto] = useState<File | null>(null);
  const { result, loading, evaluate } = useEvaluate();
  // Start from what the donor confirmed when registering; the photo check adds anything it spots.
  const [allergens, setAllergens] = useState(event.allergens ?? []);
  const [dietary, setDietary] = useState(event.dietary ?? []);
  type Tags = { allergens: string[]; dietary: string[] };
  const close = () => dispatch({ type: "CLOSE_PING" });

  const [confirming, setConfirming] = useState(false);
  // Flagged by the quality check: ask the donor to confirm before sharing.
  async function check(): Promise<{ ev: Evaluation; tags: Tags }> {
    const ev = await evaluate("food", description, photo);
    const tags = { allergens: mergeTags(allergens, knownTags(ev.attributes.allergens, ALLERGEN_OPTIONS)), dietary: mergeTags(dietary, knownTags(ev.attributes.dietary, DIETARY_OPTIONS)) };
    setAllergens(tags.allergens);
    setDietary(tags.dietary);
    return { ev, tags };
  }

  async function share() {
    const { ev, tags } = result ? { ev: result, tags: { allergens, dietary } } : await check();
    if (needsQualityConfirm(ev.quality)) return setConfirming(true);
    await broadcast(ev, tags);
  }

  async function broadcast(ev: Evaluation, tags: Tags) {
    setConfirming(false);
    const postedAt = Date.now();
    dispatch({
      type: "BROADCAST",
      batch: {
        id: newId("bat"), category: "food", title: ev.title, institution: event.institution, department: event.department,
        address: event.address, eventId: event.id, totalQty: qty, remainingQty: qty, status: "AVAILABLE",
        attributes: { storage: event.storage, ...ev.attributes, ...tags }, transport: event.transport, postedAt,
        pickupBy: Math.max(event.end, postedAt) + ev.pickupWindowHours * 3600_000, aiSource: ev.source, quality: ev.quality,
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
          <Field label="How many meals are left?" hint={`At least ${MIN_FOOD_QTY}; smaller amounts aren't worth a pickup trip.`}>
            <input type="number" min={MIN_FOOD_QTY} className={`${inputCls} text-2xl font-bold`} value={qty} onChange={(e) => setQty(Math.max(MIN_FOOD_QTY, Math.floor(+e.target.value) || MIN_FOOD_QTY))} />
          </Field>
          <Field label="What's left (helps AI tag allergens)">
            <textarea rows={2} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <PhotoPicker file={photo} onChange={setPhoto} />
          <button className={btn.secondary} disabled={loading} onClick={() => void check()}>
            <Sparkles className="h-4 w-4" /> {loading ? "Checking…" : "Check with AI"}
          </button>
        </div>
        <div className="space-y-4 rounded-3xl bg-brand-50/40 p-5 ring-1 ring-brand-100">
          <TagChips label="Contains allergens" tone="red" options={ALLERGEN_OPTIONS} selected={allergens} onToggle={(v) => setAllergens(toggleTag(allergens, v))} />
          <TagChips label="Dietary" tone="green" options={DIETARY_OPTIONS} selected={dietary} onToggle={(v) => setDietary(toggleTag(dietary, v))} />
          <div className="border-t border-brand-100 pt-4">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold">AI food check {result && <AiSourceBadge source={result.source} />}</div>
          {result ? (
            <div className="space-y-3 text-sm">
              <div className="font-medium">{result.title}</div>
              <ul className="list-inside list-disc text-stone-600">{itemList("food", result.attributes).map((i) => <li key={i}>{i}</li>)}</ul>
              <AttributeTags category="food" a={{ ...result.attributes, allergens: [], dietary: [] }} />
              <p className="text-xs text-stone-500">{result.summary}</p>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-stone-500">Optional: add a photo or description and press “Check with AI” to tag allergens, storage and the pickup window.</p>
          )}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-5">
        <div className="text-sm text-stone-500">{event.transport === "Donor delivers" ? "You'll deliver it" : "A food bank will pick it up"}</div>
        <button className={btn.primary} disabled={loading} onClick={() => void share()}>
          <Radio className="h-4 w-4" /> Share {qty} leftover meals
        </button>
      </div>
      <QualityConfirm quality={result?.quality} open={confirming} onCancel={() => setConfirming(false)} onConfirm={() => result && void broadcast(result, { allergens, dietary })} />
    </Modal>
  );
}
