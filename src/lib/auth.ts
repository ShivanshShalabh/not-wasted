import type { Account, DemoState } from "./types";

/** Network hub used for distance + map placement (downtown Nashville). */
export const NETWORK_CENTER = { lat: 36.1627, lng: -86.7816 };
export const SERVICE_RADIUS_MI = 30;

export async function hashPassword(password: string) {
  const data = new TextEncoder().encode(`not-wasted:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function distanceMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Project lat/lng onto the 100×80 SVG network map (≈6 mi across). */
export function toMapXY(lat: number, lng: number) {
  const x = 50 + (lng - NETWORK_CENTER.lng) * 480;
  const y = 40 - (lat - NETWORK_CENTER.lat) * 600;
  return { x: Math.min(95, Math.max(5, x)), y: Math.min(75, Math.max(5, y)) };
}

export const currentAccount = (state: DemoState): Account | undefined => state.accounts.find((a) => a.id === state.sessionId);

export const DONOR_TYPES = [
  "Corporation / Workplace",
  "School / University",
  "Hospital / Healthcare",
  "Retailer",
  "Restaurant / Food service",
  "Hotel / Hospitality",
  "Event venue / Conference center",
  "Other",
];

export const RECIPIENT_TYPES = [
  "Food pantry",
  "Shelter",
  "Community center",
  "Nonprofit organization",
  "Religious/community organization",
  "Furniture bank",
  "Clothing closet",
  "Other",
];

/** Donors see only their own organization's events and donations. */
export function myDonorData(state: DemoState) {
  const me = currentAccount(state);
  const mine = (inst: string) => !!me && inst.trim().toLowerCase() === me.orgName.trim().toLowerCase();
  return { events: state.events.filter((e) => mine(e.institution)), batches: state.batches.filter((b) => mine(b.institution)) };
}
