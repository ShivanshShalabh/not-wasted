"use client";

import { useEffect, useRef } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import type { AreaNeed } from "@/lib/types";

interface LocateResponse {
  geo?: { ok: boolean; data?: { lat: number; lng: number; tract?: string } | null };
  access?: { ok: boolean; data?: { tract: string; lowIncomeLowAccess: boolean; povertyRate: number } | null } | null;
  need?: number | null;
}

/**
 * Looks up each recipient's neighborhood need once (Census Geocoder → USDA Food Access Atlas)
 * and stores it on the org, so matching can favor under-served areas. Failures are skipped silently.
 */
export function useAreaNeeds() {
  const { state, dispatch } = useNotWasted();
  const asked = useRef(new Set<string>());

  useEffect(() => {
    const missing = state.recipients.filter((r) => !r.area && r.address && !asked.current.has(r.id));
    if (!missing.length) return;
    missing.forEach((r) => asked.current.add(r.id));
    void Promise.all(
      missing.map(async (r): Promise<[string, AreaNeed] | null> => {
        try {
          const d = (await (await fetch(`/api/data/locate?address=${encodeURIComponent(r.address)}`)).json()) as LocateResponse;
          const a = d.access?.data;
          if (!a || d.need == null) return null;
          return [r.id, { tract: a.tract, need: d.need, lowIncomeLowAccess: a.lowIncomeLowAccess, povertyRate: a.povertyRate, lat: d.geo?.data?.lat, lng: d.geo?.data?.lng }];
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      const areas = Object.fromEntries(rows.filter((x): x is [string, AreaNeed] => !!x));
      if (Object.keys(areas).length) dispatch({ type: "SET_AREA", areas });
    });
  }, [state.recipients, dispatch]);
}
