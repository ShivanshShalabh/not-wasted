import { predictSurplus } from "./forecast";
import type { Account, Batch, Claim, DemoState, DonorEvent, RecipientOrg } from "./types";

export const STATE_VERSION = 9;
const MIN = 60_000;
const HOUR = 60 * MIN;

export const RECIPIENTS: RecipientOrg[] = [
  {
    id: "rcp_second_harvest", name: "Second Harvest Metro Hub", type: "Food Bank",
    address: "331 Great Circle Rd, Nashville, TN 37228", distanceMi: 1.2, x: 38, y: 30,
    acceptedCategories: ["food"], capacity: { food: 120 }, notifyChannel: "Email", contact: "dispatch@secondharvest-metro.org", verified: true,
    needs: ["boxed lunches", "produce", "sandwiches", "dry goods", "bulk"], hasTruck: true, coldStorage: true,
    requirements: "Regional food bank serving 40 partner pantries. We take bulk boxed lunches, sandwiches, produce and dry goods. Everything must be sealed or individually wrapped and have at least 4 hours of safe shelf life left. We have refrigerated trucks and walk-in coolers.",
  },
  {
    id: "rcp_eastside", name: "Eastside Community Pantry", type: "Food Pantry",
    address: "1010 Gallatin Ave, Nashville, TN 37206", distanceMi: 2.4, x: 76, y: 34,
    acceptedCategories: ["food"], capacity: { food: 55 }, notifyChannel: "SMS", contact: "+1 615-555-0142", verified: true,
    needs: ["prepared meals", "families", "pastry", "breakfast", "fruit"], hasTruck: false, coldStorage: true,
    requirements: "Neighborhood pantry for families with young kids. Many of our clients are Muslim, so halal or vegetarian meals are preferred and we cannot take pork. Breakfast items, fruit and pastries go fast. Small fridge only, so cold food in modest quantities.",
  },
  {
    id: "rcp_st_lukes", name: "St. Luke's Soup Kitchen", type: "Soup Kitchen & Shelter",
    address: "5601 New York Ave, Nashville, TN 37209", distanceMi: 3.1, x: 18, y: 62,
    acceptedCategories: ["food", "clothing"], capacity: { food: 80, clothing: 150 }, notifyChannel: "Email", contact: "meals@stlukes-nash.org", verified: true,
    needs: ["hot meals", "pasta", "soup", "rice", "coats", "winter", "towels", "linens"], hasTruck: false, coldStorage: false,
    requirements: "Soup kitchen serving ~200 hot meals a day, including several diabetic and gluten-sensitive guests. Nut-free please: we serve a children's program and keep the kitchen peanut and tree-nut free. No refrigeration, so we need hot or shelf-stable food we can serve the same day. We also hand out winter coats, towels and linens to shelter guests.",
  },
  {
    id: "rcp_music_city_furniture", name: "Music City Furniture Bank", type: "Furniture Bank",
    address: "2400 Clifton Ave, Nashville, TN 37209", distanceMi: 4.0, x: 24, y: 18,
    acceptedCategories: ["furniture", "other"], capacity: { furniture: 60, other: 40 }, notifyChannel: "Email", contact: "pickups@mcfurniturebank.org", verified: true,
    needs: ["chairs", "desks", "tables", "beds", "dressers", "sofas", "lamps", "monitors"], hasTruck: true, coldStorage: false,
    requirements: "We furnish homes for families leaving homelessness. Need beds, dressers, tables, chairs and sofas in usable condition. No stained mattresses or broken frames. We bring our own truck and two-person crew.",
  },
  {
    id: "rcp_hope_threads", name: "Hope Threads Clothing Closet", type: "Clothing Closet",
    address: "1800 Dickerson Pike, Nashville, TN 37207", distanceMi: 2.8, x: 64, y: 14,
    acceptedCategories: ["clothing", "other"], capacity: { clothing: 300, other: 25 }, notifyChannel: "SMS", contact: "+1 615-555-0199", verified: true,
    needs: ["uniforms", "professional", "coats", "shirts", "linens", "towels", "backpacks", "shoes"], hasTruck: false, coldStorage: false,
    requirements: "Clothing closet focused on job seekers and students. Professional clothing, uniforms, shoes, coats and backpacks are most needed. Items must be clean and free of tears; we also accept towels and bed linens.",
  },
];

/** Password for every demo account: demo1234 */
const DEMO_HASH = "ba8ba464d2aff67acd78d948505dcc82ded275e44c1cce0c5a9a69f8ee9ef4bf";

export const SAMPLE_LOGINS = {
  donor: { email: "donor@notwasted.org", password: "demo1234" },
  recipient: { email: "recipient@notwasted.org", password: "demo1234" },
};

const RECIPIENT_EMAILS: Record<string, string> = {
  rcp_st_lukes: SAMPLE_LOGINS.recipient.email,
  rcp_second_harvest: "secondharvest@notwasted.org",
  rcp_eastside: "eastside@notwasted.org",
  rcp_music_city_furniture: "furniture@notwasted.org",
  rcp_hope_threads: "hopethreads@notwasted.org",
};

export const DEMO_ACCOUNTS: Account[] = [
  {
    id: "acc_vanderbilt", role: "donor", email: SAMPLE_LOGINS.donor.email, passwordHash: DEMO_HASH,
    orgName: "Vanderbilt University", orgType: "School / University", address: "2201 West End Ave, Nashville, TN 37235",
    lat: 36.1447, lng: -86.8027, contactName: "Maya Chen, Campus Events & Sustainability", phone: "+1 615-555-0100",
  },
  ...RECIPIENTS.map((r): Account => ({
    id: `acc_${r.id.slice(4)}`, role: "recipient", email: RECIPIENT_EMAILS[r.id], passwordHash: DEMO_HASH,
    orgName: r.name, orgType: r.type, address: r.address,
    contactName: r.id === "rcp_st_lukes" ? "Father James Ortiz, Kitchen Director" : "Operations Lead",
    phone: r.contact.includes("@") ? "+1 615-555-0150" : r.contact, recipientId: r.id,
  })),
];

export function createSeedState(now = Date.now()): DemoState {
  const careerFair: DonorEvent = {
    id: "evt_career_fair",
    name: "Boxed lunch leftovers",
    institution: "Vanderbilt University",
    department: "School of Engineering — Career Center",
    address: "2301 Vanderbilt Pl, Nashville, TN 37235",
    eventType: "Career Fair",
    start: now - 3 * HOUR,
    end: now + 44 * MIN,
    rsvps: 300,
    foodOrdered: 400,
    mealDescription: "Boxed lunches: turkey & veggie wraps, chips, cookies, fruit",
    allergens: ["Gluten", "Dairy", "Eggs"],
    dietary: [],
    storage: "Refrigerated",
    transport: "Recipient picks up",
    contact: "events@engineering.vanderbilt.edu",
    predictedSurplus: predictSurplus({ rsvps: 300, foodOrdered: 400, eventType: "Career Fair" }).surplus,
    pingSent: false,
  };
  const grandRounds: DonorEvent = {
    id: "evt_grand_rounds",
    name: "Pasta & salad trays",
    institution: "Vanderbilt University",
    department: "VUMC — Graduate Medical Education",
    address: "1211 Medical Center Dr, Nashville, TN 37232",
    eventType: "Medical Rounds",
    start: now - 2 * HOUR,
    end: now - 10 * MIN,
    rsvps: 220,
    foodOrdered: 300,
    mealDescription: "Hot pasta primavera & garden salad",
    allergens: ["Gluten", "Dairy"],
    dietary: ["Vegetarian"],
    storage: "Warm/Insulated",
    transport: "Recipient picks up",
    contact: "gme-events@vumc.org",
    predictedSurplus: 106,
    pingSent: true,
    batchId: "bat_grand_rounds",
  };
  const techSummit: DonorEvent = {
    id: "evt_tech_summit",
    name: "Pastry & fruit boxes",
    institution: "Vanderbilt University",
    department: "Owen School of Management — Industry Relations",
    address: "401 21st Ave S, Nashville, TN 37203",
    eventType: "Corporate Event",
    start: now - 5 * HOUR,
    end: now - 3 * HOUR,
    rsvps: 320,
    foodOrdered: 340,
    mealDescription: "Pastry & fruit boxes",
    allergens: ["Gluten", "Dairy", "Eggs", "Tree nuts"],
    dietary: ["Vegetarian"],
    storage: "Shelf-Stable",
    transport: "Donor delivers",
    contact: "industry@owen.vanderbilt.edu",
    predictedSurplus: 100,
    pingSent: true,
    batchId: "bat_tech_summit",
  };

  const batches: Batch[] = [
    {
      id: "bat_grand_rounds", category: "food", title: "Hot Pasta & Salad Meal Packets",
      institution: grandRounds.institution, department: grandRounds.department, address: grandRounds.address, eventId: grandRounds.id,
      totalQty: 100, remainingQty: 50, status: "AVAILABLE",
      attributes: { items: ["Pasta primavera", "Garden salad", "Dinner roll"], allergens: ["Gluten", "Dairy"], dietary: ["Vegetarian"], storage: "Warm/Insulated", shelfLifeHours: 3 },
      transport: "Recipient picks up", postedAt: now - 25 * MIN, pickupBy: now + 2 * HOUR + 35 * MIN, aiSource: "local",
    },
    {
      id: "bat_tech_summit", category: "food", title: "Pastry & Fruit Boxes",
      institution: techSummit.institution, department: techSummit.department, address: techSummit.address, eventId: techSummit.id,
      totalQty: 80, remainingQty: 0, status: "FULLY_CLAIMED",
      attributes: { items: ["Croissants", "Muffins", "Fresh fruit cup"], allergens: ["Gluten", "Dairy", "Eggs", "Tree nuts"], dietary: ["Vegetarian"], storage: "Shelf-Stable", shelfLifeHours: 8 },
      transport: "Donor delivers", postedAt: now - 3 * HOUR - 5 * MIN, pickupBy: now + 4 * HOUR, aiSource: "local",
    },
    {
      id: "bat_office_reno", category: "furniture", title: "Office Chairs & Desks (Renovation Clear-out)",
      institution: "Vanderbilt University", department: "Campus Planning & Construction", address: "2525 West End Ave, Nashville, TN 37203",
      totalQty: 40, remainingQty: 25, status: "AVAILABLE",
      attributes: { itemTypes: ["Ergonomic office chairs", "Steel-frame desks", "Filing cabinets"], condition: "Good", needsTruck: true, twoPersonLift: true, dimensions: "Desks 60×30 in; chairs stackable" },
      transport: "Recipient picks up", postedAt: now - 20 * HOUR, pickupBy: now + 52 * HOUR, aiSource: "local",
    },
    {
      id: "bat_hotel_linen", category: "clothing", title: "Residence Hall Linen & Uniform Refresh",
      institution: "Vanderbilt University", department: "Housing & Residential Education", address: "1 Commons Center, Nashville, TN 37212",
      totalQty: 200, remainingQty: 200, status: "AVAILABLE",
      attributes: { garmentTypes: ["Bath towels", "Bed linens", "Chef jackets", "Polo uniforms"], sizeRange: "S–XXL", season: "All-season", condition: "Like New" },
      transport: "Donor delivers", postedAt: now - 2 * HOUR, pickupBy: now + 70 * HOUR, aiSource: "local",
    },
  ];

  const claims: Claim[] = [
    { id: "clm_seed_1", batchId: "bat_grand_rounds", recipientId: "rcp_eastside", qty: 50, claimedAt: now - 18 * MIN, etaMinutes: 20, pickupBy: batches[0].pickupBy, status: "CLAIMED" },
    { id: "clm_seed_2", batchId: "bat_tech_summit", recipientId: "rcp_second_harvest", qty: 50, claimedAt: now - 3 * HOUR, etaMinutes: 15, pickupBy: batches[1].pickupBy, status: "PICKED_UP", pickedUpAt: now - 2 * HOUR },
    { id: "clm_seed_3", batchId: "bat_tech_summit", recipientId: "rcp_eastside", qty: 30, claimedAt: now - 2 * HOUR - 50 * MIN, etaMinutes: 20, pickupBy: batches[1].pickupBy, status: "PICKED_UP", pickedUpAt: now - 2 * HOUR },
    { id: "clm_seed_4", batchId: "bat_office_reno", recipientId: "rcp_music_city_furniture", qty: 15, claimedAt: now - 18 * HOUR, etaMinutes: 26, pickupBy: batches[2].pickupBy, status: "CLAIMED" },
  ];

  return {
    version: STATE_VERSION,
    view: "donor",
    activeRecipientId: "rcp_st_lukes",
    events: [careerFair, grandRounds, techSummit],
    batches,
    claims,
    waitlist: [],
    recipients: RECIPIENTS.map((r) => ({ ...r, capacity: { ...r.capacity } })),
    pingEventId: null,
    accounts: DEMO_ACCOUNTS.map((a) => ({ ...a })),
    sessionId: null,
    lastError: null,
    lastNotice: null,
  };
}
