import "server-only";
import { fetchJson } from "./http";

/** ProPublica Nonprofit Explorer API (IRS Exempt Organizations data, public): verify an org's 501(c)(3) status. */
export interface Nonprofit { ein: string; name: string; city: string; state: string; is501c3: boolean; url: string }

interface PpResponse { organizations?: Array<{ ein: number; strein: string; name: string; city: string; state: string; subseccd?: number }> }

export function parseNonprofits(d: PpResponse): Nonprofit[] {
  return (d.organizations ?? []).map((o) => ({
    ein: o.strein,
    name: o.name,
    city: o.city,
    state: o.state,
    is501c3: o.subseccd === 3,
    url: `https://projects.propublica.org/nonprofits/organizations/${o.ein}`,
  }));
}

export async function searchNonprofits(name: string, state = "TN") {
  const url = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(name)}&state%5Bid%5D=${state}`;
  return parseNonprofits(await fetchJson<PpResponse>(url, { ttlMs: 24 * 3600_000 })).slice(0, 5);
}
