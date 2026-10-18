import { NextResponse } from "next/server";

/** Catalog of agent endpoints (all POST JSON with the client's network state). */
export function GET() {
  return NextResponse.json({
    agents: [
      { id: "outreach", method: "GET /api/agent/scout + POST /api/ai/outreach", does: "Scans event feeds, forecasts leftovers, drafts organizer emails" },
      { id: "rescue", method: "POST /api/agents/rescue", body: "{ state, now? }", does: "Finds pickups about to miss their window; hands food to the waitlist or re-matches it; drafts an urgent text" },
      { id: "route", method: "POST /api/agents/route", body: "{ state, recipientId, now? }", does: "Plans a recipient's pickup run by deadline and distance; writes a driver checklist" },
      { id: "intake", method: "POST /api/agents/intake", body: "{ text, now? }", does: "Turns a donor's message into a donation draft and lists what is missing" },
      { id: "forecast", method: "POST /api/agents/forecast", body: "{ state, now? }", does: "Learns no-show rates from past events and recommends smaller catering orders" },
      { id: "report", method: "POST /api/agents/report", body: "{ state, now? }", does: "Writes the weekly network summary and a tax letter per donor" },
      { id: "split", method: "POST /api/agents/split", body: "{ state, batchId }", does: "Splits an oversized donation across recipients by capacity and fit" },
    ],
  });
}
