# Agents

The agent console lives at **`/agents`**, separate from the main app navigation. Signed-in users reach it from the account menu under "Agent console". Each agent can be deep-linked with `/agents?agent=<id>`.

## How the agents work
- **Same endpoint for UI and scripts:** every agent is also a JSON endpoint, and the console calls those same endpoints. `GET /api/agents` lists them all.
- **Stateless:** the client posts its current network state (`{ state, now }`, the same shape the app keeps in local storage). The endpoint returns a plan plus a trace (`steps`), and the user approves each action before the client applies it.
- **Pure planning:** the planning logic in `src/lib/agents/*.ts` makes no network calls and has unit tests (`src/lib/agents/agents.test.ts`).
- **AI writing with a fallback:** text such as messages, checklists and letters goes through `writeWithAI` in `src/lib/oci-service.ts`. It uses OCI Generative AI when that is enabled and falls back to a deterministic template otherwise.
- **Trace format:** each trace step looks like `{ title, detail[], source? }`. `source` names the public dataset or model used in that step (see [DATA_SOURCES.md](DATA_SOURCES.md)).

| Agent | Endpoint | Body | What it does | Acts by |
|---|---|---|---|---|
| Pickup rescue | `POST /api/agents/rescue` | `{ state, now? }` | Finds open claims within 30 minutes of (or past) their pickup window. Offers the food to the next waitlisted org, or re-ranks nearby orgs. Drafts an urgent SMS. | `CANCEL_CLAIM`, which auto-claims for the waitlist; the text send is simulated |
| Donor intake | `POST /api/agents/intake` | `{ text, now? }` | Free text (e.g. "~80 sandwiches left in Rand, gone by 3pm") → AI evaluation plus parsed quantity, deadline and place. Returns the questions still missing. | `BROADCAST` of the completed batch |
| Capacity splitter | `POST /api/agents/split` | `{ state, batchId }` | Splits a donation that is too big for any single recipient's capacity, in match-score order, and drafts a confirmation request to each. | `CLAIM` per confirmed share |
| Route planner | `POST /api/agents/route` | `{ state, recipientId, now? }` | Orders a recipient's open pickups by earliest deadline, weighted by drive time (22 mph × 1.3 street factor, 10 min loading). Flags truck, lifting and cold-chain needs, and writes a driver checklist. | Read-only; sending the checklist is simulated |
| Event forecaster | `POST /api/agents/forecast` | `{ state, now? }` | Learns each event type's no-show rate from past events, back-tests the error before and after (leave-one-out), and recommends smaller catering orders for upcoming events. | `UPDATE_EVENT_ORDER` |
| Weekly impact report | `POST /api/agents/report` | `{ state, now? }` | Totals the last 7 days of claims per donor, then writes a network summary and one tax-acknowledgment letter per donor, held for review. | Read-only; sending is simulated |
| Event outreach | `GET /api/agent/scout`, `POST /api/ai/outreach` | — / `{ event, sender }` | Simulated event feed enriched with real geocoding and weather. Forecasts leftovers and drafts emails to organizers. | Sending is simulated |

## Data each agent uses
- **Rescue and split:** the waitlist and the semantic, dietary and area-need matching in `src/lib/matching.ts`. Area need comes from USDA Food Access Research Atlas data.
- **Route:** donor and recipient addresses are geocoded with the U.S. Census Geocoder. An address it can't match falls back to the city center, and the trace says so.
- **Outreach:** event venues are geocoded with the U.S. Census Geocoder, and Open-Meteo supplies event-day weather that adjusts the no-show model.
- **Forecaster:** uses `DEMO_HISTORY`, ten synthetic past events labelled as demo data in the UI, plus every event confirmed in the app (the predicted count vs the leftover quantity actually posted).
- **Report:** the per-category weight, CO2e and value estimates in `src/lib/categories.ts`. These are estimates, not tax advice.

## Demo helpers
- **Rescue:** "Simulate a late pickup" dispatches `DEMO_LATE_PICKUP`, which pulls the soonest open claim to 12 minutes from its deadline.
- **Split:** "Post a 300-meal test donation" creates a batch larger than any single food bank's capacity.

## Example
```bash
curl -s localhost:3000/api/agents | jq '.agents[].id'
curl -s -X POST localhost:3000/api/agents/intake -H 'content-type: application/json' \
  -d '{"text":"~80 turkey sandwiches left in Rand Hall, gone by 3pm"}' | jq '.draft, .missing'
```
