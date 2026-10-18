"use client";

import { useRef, useState } from "react";
import type { AgentStep } from "@/lib/agents/trace";
import { useNotWasted } from "@/context/NotWastedContext";

/**
 * Calls an agent endpoint with the current network state, then reveals its trace one step at
 * a time so people can follow what the agent did. `T` is the endpoint's JSON response.
 */
export function useAgent<T extends { steps?: AgentStep[]; error?: string }>(endpoint: string) {
  const { state } = useNotWasted();
  const [data, setData] = useState<T | null>(null);
  const [shown, setShown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  async function run(extra: Record<string, unknown> = {}) {
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    setShown(0);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, now: Date.now(), ...extra }) });
      const json = (await res.json()) as T;
      if (id !== runId.current) return null;
      if (!res.ok || json.error) throw new Error(json.error ?? `Agent failed (${res.status})`);
      setData(json);
      for (let i = 1; i <= (json.steps?.length ?? 0); i++) {
        await new Promise((r) => setTimeout(r, 420));
        if (id !== runId.current) return null;
        setShown(i);
      }
      return json;
    } catch (e) {
      if (id === runId.current) setError((e as Error).message);
      return null;
    } finally {
      if (id === runId.current) setLoading(false);
    }
  }

  const done = !!data && !loading && shown >= (data.steps?.length ?? 0);
  return { run, data, setData, steps: data?.steps?.slice(0, shown) ?? [], loading, done, error, reset: () => { runId.current++; setData(null); setShown(0); setError(null); } };
}
