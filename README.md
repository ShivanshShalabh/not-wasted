# Not Wasted
### Surplus saved

**Not Wasted** is an organization-to-organization surplus exchange. It connects institutional donors (universities, hospitals, corporate campuses, hotels, conference centers) with verified recipient organizations (food banks, soup kitchens, shelters, furniture banks, clothing closets). It handles **food, furniture, clothing, and other items**, and it runs on **Oracle Cloud Infrastructure**.

Built for the Oracle Hackathons International challenge *"From Surplus to Social Good"*, starting in Nashville.

---

## Pitch

**Pain points**
1. Catered events end, and hundreds of meals are thrown away within minutes, because nobody knows who could take them in time.
2. Food banks get no predictability. Surplus arrives unannounced, with no fridge space reserved and no pickup plan.
3. One donation is often too big for one recipient, so the whole thing is refused instead of split.
4. Furniture from renovations and clothing from linen refreshes go to landfill, because coordinating pickup is harder than throwing them away.

**How we solve it**
- **Pre-event forecast.** Donors register events once. AI predicts surplus from RSVPs, portions ordered, no-show rates, and weather. Food banks reserve space in advance.
- **T-45 ping.** 45 minutes before an event ends, the organizer confirms the real leftover count and snaps a photo. **OCI Generative AI Vision** tags allergens, storage needs, and a safe pickup window.
- **Split claiming.** Nearby verified recipients claim exactly what they can store. An atomic decrement keeps everyone in sync, and the batch locks at 0.
- **Scan, don't type.** Drop a screenshot of an event invite or flyer and AI fills the registration form. For surplus items, snap a photo: AI identifies the category, items, condition and handling needs. The donor only enters the quantity. Manual entry is still available for both.
- **Smart matching.** Every donation ranks nearby recipients by capacity fit, distance, stated needs, and handling (truck, cold storage). Donors see the top matches before broadcasting, and recipients see a "Top match" badge on donations that suit them best.
- **Any surplus.** The same flow works for furniture (condition, truck or 2-person lift), clothing (type, sizes, season), and other items.
- **Impact proof.** Live ESG metrics, plus a **Select AI** executive summary with Good Samaritan / IRS §170(e)(3) estimates.

**Next level:** recurring-event auto-registration, learned forecasts from platform history, real SMS/email notifications, transport credits and hub routing, and more cities.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # split-claim invariant tests
```

No credentials are needed. All AI runs on deterministic local fallbacks until OCI is configured.

## 30-second judge script
On first visit, the app opens on **registration**: choose Donor or Recipient, then enter your location, then fill in the organization profile (name, type, contact, password). Or go to **Sign in** and use a sample account:

| Account | Email | Password |
|---|---|---|
| Sample donor (Vanderbilt University) | `donor@notwasted.org` | `demo1234` |
| Sample recipient (St. Luke's Soup Kitchen) | `recipient@notwasted.org` | `demo1234` |
| Other recipients | `secondharvest@`, `eastside@`, `furniture@`, `hopethreads@notwasted.org` | `demo1234` | The account menu (top right) switches accounts or signs out.

1. Sign in as **St. Luke's Soup Kitchen**. On *Hot Pasta & Salad* (50 / 100 left), click **Claim**, then **All (50)**, then **Confirm**. The card locks.
2. Switch to **Vanderbilt University** (donor). Click **T-45 Ping**, confirm `100`, then **Broadcast**. The top food-bank matches are listed.
3. Switch to *Second Harvest* and claim 50. Switch to *Eastside*: the claim is capped by its free space.
4. Back as **Vanderbilt University**, the Grand Rounds card shows the live split. Open **Manage pickups**, then **Confirm handoff**.
5. As Vanderbilt, click **Post surplus** and drop a photo, for example `chairs.jpg`. Enter `30`. Music City Furniture Bank shows as the top match.
6. **Network impact**: tap the tax-deduction number to see how it was estimated, then open **Impact report** and press **Run report agent** (or **Generate report**). The OCI architecture view lives in the agent console at `/agents`.
7. Use **Reset demo data** in the account menu.

## Category model
| Category | Unit | Pickup window | AI-tagged attributes |
|---|---|---|---|
| Food | meal packets | ~3 h (shelf-life) | items, allergens, dietary, storage |
| Furniture | pieces | 72 h | item types, condition, truck / 2-person lift, dimensions |
| Clothing | items | 72 h | garment types, size range, season, condition |
| Other | items | 72 h | condition, notes |

Each recipient org declares accepted categories and free capacity per category. A claim is capped at `min(remaining_qty, capacity[category])`.

## Architecture
```
Next.js App Router (TypeScript, Tailwind)
 ├─ src/context/NotWastedContext.tsx   React state + localStorage + cross-tab sync
 ├─ src/lib/inventory.ts               single owner of claim / cancel / quantity invariants
 ├─ src/lib/matching.ts                donor ↔ recipient ranking (twin of the 26ai vector + spatial query)
 ├─ src/lib/oci-service.ts             OCI GenAI adapter (vision, text) with local fallback
 ├─ src/app/api/ai/{evaluate,extract-event,forecast,impact}
 └─ db/schema_oracle26ai.sql           26ai schema: atomic claim proc, Spatial, Vector, Select AI
```

| OCI service | Used for |
|---|---|
| OCI Generative AI (multimodal chat) | Photo eval: allergens, condition, handling |
| OCI Generative AI (text) | Forecast rationale, executive narrative |
| Oracle AI Database 26ai | `UPDATE … WHERE remaining_qty >= :claim_qty` atomic claims, JSON attributes |
| Oracle Spatial | `SDO_WITHIN_DISTANCE` recipient matching |
| AI Vector Search | `VECTOR_DISTANCE(..., COSINE)` batch-to-need fit |
| Select AI | `SELECT AI NARRATE` ESG reports |
| Container Instances / OKE + OCIR | Hosting (standalone Docker image) |

The demo keeps state client-side so a live pitch can never fail. `db/schema_oracle26ai.sql` mirrors the same rules: the `claim_batch` / `cancel_claim` procedures match `claimBatch` / `cancelClaim` in `src/lib/inventory.ts`. Connecting through `oracledb` means swapping the context dispatch for API calls into those procedures.

## Agents
An agent console at **`/agents`**, outside the main navigation and reached from the account menu, runs seven agents:
- **Pickup rescue:** saves food when a pickup is about to be missed.
- **Donor intake:** turns a chat message into a posted donation.
- **Capacity splitter:** divides a donation too big for one food bank.
- **Route planner:** plans a food bank's pickup run.
- **Event forecaster:** learns from past events and recommends smaller catering orders.
- **Weekly impact report:** writes a network summary and donor tax letters.
- **Event outreach:** finds events and drafts emails to their organizers.

Each one is also a JSON endpoint under `/api/agents` and shows its reasoning step by step. Every action waits for a human to approve it. See [docs/AGENTS.md](docs/AGENTS.md).

## Public data
The app pulls seven free public datasets live, on the server, and falls back gracefully if one is down:

- **EPA Excess Food Opportunities Map:** real Nashville food banks and pantries, plus schools with estimated excess food.
- **USDA Food Access Research Atlas:** low-income and low-access census tracts. Stored with recipient locations; not used for matching.
- **U.S. Census Geocoder:** addresses to coordinates and census tracts.
- **Open-Meteo:** event-day weather, which adjusts the leftover forecast.
- **Open Food Facts:** barcode lookup for allergens and diet labels.
- **USDA FoodData Central:** typical ingredients for a dish, and their allergens.
- **ProPublica Nonprofit Explorer (IRS data):** 501(c)(3) verification.

See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for the endpoints, the fields used, licenses, caveats, and what is still simulated. Set `FDC_API_KEY` for USDA FoodData Central limits above the shared demo key.

## Enable live OCI Generative AI
```bash
cp .env.example .env.local
# set OCI_GENAI_ENABLED=true, OCI_COMPARTMENT_ID, region, and model IDs
```
Auth (`OCI_AUTH`):
- `config` uses `~/.oci/config`
- `instance` uses an instance principal
- `resource` uses a resource principal, the right choice inside Container Instances

The dashboard badge shows whether OCI is live. Each AI result shows **OCI Generative AI** or **Local AI fallback**.

## Deploy to OCI
The live demo runs on an OCI Compute VM, with Caddy in front for automatic HTTPS:
```bash
scripts/deploy-oci.sh            # build, upload the image tarball to Object Storage, restart the VM
SKIP_BUILD=1 scripts/deploy-oci.sh
```
On each boot, the VM (`scripts/vm-cloud-init.yaml`) downloads the image from a private bucket using its instance principal. No registry credentials live on the VM. It runs with `OCI_AUTH=instance`.
A Container Instance (`OCI_AUTH=resource`) works too, once the tenancy has E4 core quota.
Run `db/schema_oracle26ai.sql` in Autonomous Database (26ai) via Database Actions / SQL Developer.

## Roadmap
- Live Autonomous DB persistence through `oracledb`
- Real notifications (OCI Notifications: SMS / email)
- Transport credits and hub pickups for bulky items
- Forecasts trained on platform history
- Accessibility kiosks and end-user access (deliberately out of scope for v1, which is org-to-org only)

## Notes
- Recipient seed data is modeled on public food-bank listings. *Music City Furniture Bank* and *Hope Threads Clothing Closet* are fictional demo orgs.
- Tax and CO2e figures are estimates for demonstration only. They are not tax advice.
- The Outreach agent's event feed is simulated. Its weather and venue geocoding are real public data (see docs/DATA_SOURCES.md).
