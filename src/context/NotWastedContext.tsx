"use client";

import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";
import { reducer, type Action } from "@/lib/inventory";
import { createSeedState, STATE_VERSION } from "@/lib/seed";
import type { DemoState } from "@/lib/types";

const KEY = "not-wasted-state";

const Ctx = createContext<{ state: DemoState; dispatch: Dispatch<Action>; now: number } | null>(null);

export function NotWastedProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createSeedState());
  const [now, setNow] = useState(() => Date.now());
  const hydrated = useRef(false);
  // Seed timestamps depend on Date.now(); render only on the client to avoid hydration mismatches.
  const [mounted, setMounted] = useState(false);
  const fromStorage = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const saved = raw ? (JSON.parse(raw) as DemoState) : null;
      if (saved?.version === STATE_VERSION) dispatch({ type: "HYDRATE", state: saved });
    } catch {
      /* ignore corrupt storage */
    }
    hydrated.current = true;
    setMounted(true);

    // Cross-tab sync: judges can open Donor and Food Bank views side by side.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        fromStorage.current = true;
        dispatch({ type: "HYDRATE", state: JSON.parse(e.newValue) as DemoState });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (fromStorage.current) {
      fromStorage.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked */
    }
  }, [state]);

  if (!mounted) return <div className="flex min-h-screen items-center justify-center text-sm text-stone-400">Loading Not Wasted…</div>;
  return <Ctx.Provider value={{ state, dispatch, now }}>{children}</Ctx.Provider>;
}

export function useNotWasted() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotWasted must be used inside NotWastedProvider");
  return ctx;
}
