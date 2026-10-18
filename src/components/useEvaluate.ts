"use client";

import { useState } from "react";
import { fileToBase64 } from "@/lib/format";
import type { Category, ItemAttributes, QualityCheck } from "@/lib/types";

export interface Evaluation {
  category: Category;
  title: string;
  summary: string;
  pickupWindowHours: number;
  attributes: ItemAttributes;
  source: "oci" | "local";
  quality?: QualityCheck;
  estimatedQty?: number;
  /** Set when the result came from a public dataset (e.g. "Open Food Facts") rather than AI. */
  dataSource?: string;
}

/** Calls /api/ai/evaluate (OCI GenAI Vision when configured, local fallback otherwise). */
export function useEvaluate() {
  const [result, setResult] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(false);

  async function evaluate(category: Category | "auto", description: string, photo?: File | null): Promise<Evaluation> {
    setLoading(true);
    try {
      const imageBase64 = photo ? await fileToBase64(photo) : undefined;
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, description, imageBase64, mimeType: photo?.type, fileName: photo?.name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Evaluation failed");
      const data = (await res.json()) as Evaluation;
      setResult(data);
      return data;
    } finally {
      setLoading(false);
    }
  }

  return { result, setResult, loading, evaluate };
}
