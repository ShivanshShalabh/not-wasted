"use client";

import { useEffect, useRef, useState } from "react";
import { donationText, recipientProfile } from "@/lib/matching";
import type { Batch, RecipientOrg } from "@/lib/types";

export type SemanticScores = Record<string, Record<string, number>>;
interface Result { scores: SemanticScores | null; source: "oci" | "local" }

const cache = new Map<string, Result>();

/**
 * OCI embedding similarity of each batch against each recipient profile, via /api/ai/semantic.
 * Returns batchId → (recipientId → 0..1), or null while loading / when OCI is off (local similarity applies).
 */
export function useSemanticScores(batches: Batch[], recipients: RecipientOrg[]) {
  const docs = batches.map((b) => ({ id: b.id, text: donationText(b) }));
  const profiles = recipients.map((r) => ({ id: r.id, text: recipientProfile(r) }));
  const key = JSON.stringify([docs.map((d) => [d.id, d.text]), profiles.map((p) => [p.id, p.text])]);
  const input = useRef({ docs, profiles });
  input.current = { docs, profiles };
  const [result, setResult] = useState<Result | null>(() => cache.get(key) ?? null);

  useEffect(() => {
    const { docs, profiles } = input.current;
    const hit = cache.get(key);
    if (hit) return setResult(hit);
    if (!docs.length || !profiles.length) return setResult(null);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/semantic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ donations: docs.map((d) => d.text), recipients: profiles.map((p) => p.text) }),
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { scores: number[][] | null; source: "oci" | "local" };
        const scores = data.scores
          ? Object.fromEntries(docs.map((d, i) => [d.id, Object.fromEntries(profiles.map((p, j) => [p.id, data.scores![i]?.[j] ?? 0]))]))
          : null;
        const out: Result = { scores, source: scores ? data.source : "local" };
        cache.set(key, out);
        setResult(out);
      } catch {
        if (!ctrl.signal.aborted) setResult({ scores: null, source: "local" });
      }
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [key]);

  return { scores: result?.scores ?? null, source: result?.source ?? "local", ready: result != null };
}
