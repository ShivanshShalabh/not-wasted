import { predictSurplus } from "./forecast";
import type { EventType } from "./types";

/**
 * Event Scout agent — simulated live feed. A production agent would poll Eventbrite,
 * campus calendars and venue APIs; here the feed is generated relative to "now" so the
 * demo always shows upcoming events. Organizer emails use example.org on purpose.
 */

export interface ScoutedEvent {
  id: string;
  name: string;
  organizer: string;
  organizerEmail: string;
  venue: string;
  address: string;
  eventType: EventType;
  start: string; // ISO
  end: string; // ISO
  attendees: number;
  catering: string;
  cateringPortions: number;
  predictedSurplus: number;
  confidence: number;
  source: string;
  sourceUrl: string;
  detectedAt: number;
}

const FEED: Array<Omit<ScoutedEvent, "id" | "start" | "end" | "predictedSurplus" | "confidence" | "detectedAt"> & { inHours: number; durationH: number }> = [
  { name: "Nashville Health Tech Summit", organizer: "Nashville Health Innovation Council", organizerEmail: "events@nashville-health-council.example.org", venue: "Music City Center, Hall C", address: "201 Rep. John Lewis Way S, Nashville, TN 37203", eventType: "Conference", attendees: 650, catering: "Boxed lunches: grilled chicken & veggie wraps, fruit cups", cateringPortions: 720, source: "Eventbrite", sourceUrl: "https://www.eventbrite.com/d/tn--nashville/conferences/", inHours: 20, durationH: 8 },
  { name: "Belmont Spring Career Expo", organizer: "Belmont University Career Services", organizerEmail: "careers@belmont.example.org", venue: "Curb Event Center", address: "2002 Belmont Blvd, Nashville, TN 37212", eventType: "Career Fair", attendees: 420, catering: "Sandwich platters, chips, cookies", cateringPortions: 480, source: "Campus events calendar", sourceUrl: "https://www.belmont.edu/events/", inHours: 28, durationH: 5 },
  { name: "Pediatrics Grand Rounds Breakfast", organizer: "Children's Hospital GME Office", organizerEmail: "gme-events@childrens-hospital.example.org", venue: "Medical Center Auditorium", address: "2200 Children's Way, Nashville, TN 37232", eventType: "Medical Rounds", attendees: 140, catering: "Bagels, yogurt parfaits, fresh fruit", cateringPortions: 180, source: "Hospital GME calendar", sourceUrl: "https://www.vumc.org/", inHours: 40, durationH: 2 },
  { name: "Chamber Small Business Breakfast", organizer: "Nashville Area Chamber of Commerce", organizerEmail: "programs@nashville-chamber.example.org", venue: "Omni Nashville, Broadway Ballroom", address: "250 Rep. John Lewis Way S, Nashville, TN 37203", eventType: "Corporate Event", attendees: 260, catering: "Hot breakfast buffet: eggs, potatoes, pastries", cateringPortions: 300, source: "Chamber events feed", sourceUrl: "https://www.nashvillechamber.com/events", inHours: 64, durationH: 3 },
  { name: "Fisk Alumni Scholarship Gala", organizer: "Fisk University Advancement", organizerEmail: "advancement@fisk.example.org", venue: "Fisk Memorial Chapel Lawn", address: "1000 17th Ave N, Nashville, TN 37208", eventType: "Gala", attendees: 320, catering: "Plated dinner: roasted chicken, rice pilaf, green beans, rolls", cateringPortions: 360, source: "Eventbrite", sourceUrl: "https://www.eventbrite.com/d/tn--nashville/galas/", inHours: 90, durationH: 4 },
  { name: "Music Row Songwriters Mixer", organizer: "Nashville Songwriters Collective", organizerEmail: "hello@songwriters-collective.example.org", venue: "Music Row Event Space", address: "1 Music Square W, Nashville, TN 37203", eventType: "Other", attendees: 180, catering: "Hot appetizers, sliders, veggie trays", cateringPortions: 220, source: "Meetup", sourceUrl: "https://www.meetup.com/find/?location=us--tn--nashville", inHours: 112, durationH: 3 },
];

const HOUR = 3_600_000;

/** Returns upcoming events with a surplus forecast, newest detection first. */
export function scoutEvents(now = Date.now()): ScoutedEvent[] {
  // Round "now" to the hour so repeated scans return stable times.
  const base = Math.floor(now / HOUR) * HOUR;
  return FEED.map(({ inHours, durationH, ...e }, i) => {
    const start = base + inHours * HOUR;
    const f = predictSurplus({ rsvps: e.attendees, foodOrdered: e.cateringPortions, eventType: e.eventType });
    return {
      ...e,
      id: `scout_${i}`,
      start: new Date(start).toISOString(),
      end: new Date(start + durationH * HOUR).toISOString(),
      predictedSurplus: f.surplus,
      confidence: f.confidence,
      detectedAt: now - (i + 1) * 7 * 60_000,
    };
  }).sort((a, b) => b.predictedSurplus - a.predictedSurplus);
}
