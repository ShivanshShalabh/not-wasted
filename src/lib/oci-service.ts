import "server-only";
import { CATEGORIES } from "./categories";
import { predictSurplus, type Weather } from "./forecast";
import type { ImpactStats } from "./impact";
import type { Category, EventType, ItemAttributes, QualityCheck } from "./types";

/**
 * OCI service adapter.
 * - OCI Generative AI (multimodal chat for vision eval, text for forecast rationale + impact narrative)
 * - Oracle AI Database 26ai (Vector + Spatial) logic lives in /db/schema_oracle26ai.sql
 * Every call falls back to deterministic local logic so live demos never fail.
 */

export type AiSource = "oci" | "local";

const env = {
  enabled: process.env.OCI_GENAI_ENABLED === "true",
  auth: process.env.OCI_AUTH ?? "config", // config | instance | resource
  configFile: process.env.OCI_CONFIG_FILE,
  profile: process.env.OCI_CONFIG_PROFILE ?? "DEFAULT",
  compartmentId: process.env.OCI_COMPARTMENT_ID ?? "",
  region: process.env.OCI_GENAI_REGION ?? "us-chicago-1",
  visionModel: process.env.OCI_GENAI_VISION_MODEL ?? "meta.llama-4-maverick-17b-128e-instruct-fp8",
  textModel: process.env.OCI_GENAI_TEXT_MODEL ?? "meta.llama-3.3-70b-instruct",
  embedModel: process.env.OCI_GENAI_EMBED_MODEL ?? "cohere.embed-v4.0",
};

export const ociStatus = () => ({ enabled: env.enabled && !!env.compartmentId, region: env.region, visionModel: env.visionModel, textModel: env.textModel });

async function ociClient() {
  const common = await import("oci-common");
  const genai = await import("oci-generativeaiinference");

  const provider =
    env.auth === "instance"
      ? await new common.InstancePrincipalsAuthenticationDetailsProviderBuilder().build()
      : env.auth === "resource"
        ? common.ResourcePrincipalAuthenticationDetailsProvider.builder()
        : new common.ConfigFileAuthenticationDetailsProvider(env.configFile, env.profile);

  const client = new genai.GenerativeAiInferenceClient({ authenticationDetailsProvider: provider });
  client.endpoint = `https://inference.generativeai.${env.region}.oci.oraclecloud.com`;
  return client;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

async function ociChat(prompt: string, opts: { model: string; image?: { base64: string; mimeType: string }; history?: ChatTurn[]; system?: string }): Promise<string> {
  const client = await ociClient();
  const content: Array<Record<string, unknown>> = [{ type: "TEXT", text: prompt }];
  if (opts.image) content.push({ type: "IMAGE", imageUrl: { url: `data:${opts.image.mimeType};base64,${opts.image.base64}` } });
  const messages = [
    ...(opts.system ? [{ role: "SYSTEM", content: [{ type: "TEXT", text: opts.system }] }] : []),
    ...(opts.history ?? []).map((t) => ({ role: t.role === "user" ? "USER" : "ASSISTANT", content: [{ type: "TEXT", text: t.text }] })),
    { role: "USER", content },
  ];

  const res = await client.chat({
    chatDetails: {
      compartmentId: env.compartmentId,
      servingMode: { servingType: "ON_DEMAND", modelId: opts.model },
      chatRequest: { apiFormat: "GENERIC", messages, maxTokens: 900, temperature: 0.2 },
    },
  } as never);

  const chat = (res as { chatResult: { chatResponse: { choices: Array<{ message: { content?: Array<{ text?: string }> } }> } } }).chatResult.chatResponse;
  return chat.choices[0]?.message.content?.map((c) => c.text ?? "").join("") ?? "";
}

/** OCI GenAI text embeddings (cohere.embed); null when OCI is off or the call fails. */
export async function embedTexts(texts: string[]): Promise<{ vectors: number[][] | null; source: AiSource }> {
  if (!ociStatus().enabled || !texts.length) return { vectors: null, source: "local" };
  try {
    const client = await ociClient();
    const res = await client.embedText({
      embedTextDetails: { inputs: texts, compartmentId: env.compartmentId, servingMode: { servingType: "ON_DEMAND", modelId: env.embedModel }, inputType: "CLUSTERING", truncate: "END" },
    } as never);
    return { vectors: (res as { embedTextResult: { embeddings: number[][] } }).embedTextResult.embeddings, source: "oci" };
  } catch (err) {
    console.warn("[oci-service] OCI embed failed, using local similarity:", (err as Error).message);
    return { vectors: null, source: "local" };
  }
}

async function withFallback<T>(oci: () => Promise<T>, local: () => T): Promise<T & { source: AiSource }> {
  if (ociStatus().enabled) {
    try {
      return { ...(await oci()), source: "oci" };
    } catch (err) {
      console.warn("[oci-service] OCI call failed, using local fallback:", (err as Error).message);
    }
  }
  return { ...local(), source: "local" };
}

function parseJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in model output");
  return JSON.parse(match[0]) as T;
}

// ---------- Vision / item evaluation ----------

export interface EvaluateInput {
  /** "auto" lets the scan decide the category from the photo. */
  category: Category | "auto";
  description: string;
  imageBase64?: string;
  mimeType?: string;
  fileName?: string;
}
export interface EvaluateResult {
  category: Category;
  title: string;
  attributes: ItemAttributes;
  pickupWindowHours: number;
  summary: string;
  quality: QualityCheck;
  /** Item count the photo or hint suggests; the donor confirms it. */
  estimatedQty?: number;
}

const KEYWORDS: Record<string, { allergen?: string; dietary?: string }> = {
  cheese: { allergen: "Dairy" }, cream: { allergen: "Dairy" }, pasta: { allergen: "Gluten" }, bread: { allergen: "Gluten" },
  roll: { allergen: "Gluten" }, wrap: { allergen: "Gluten" }, pastry: { allergen: "Gluten" }, cookie: { allergen: "Gluten" },
  egg: { allergen: "Eggs" }, nut: { allergen: "Tree nuts" }, peanut: { allergen: "Peanuts" }, shrimp: { allergen: "Shellfish" },
  fish: { allergen: "Fish" }, soy: { allergen: "Soy" }, tofu: { allergen: "Soy", dietary: "Vegan" }, veggie: { dietary: "Vegetarian" },
  vegetarian: { dietary: "Vegetarian" }, vegan: { dietary: "Vegan" }, halal: { dietary: "Halal" }, salad: { dietary: "Vegetarian" },
  chicken: { dietary: "Halal (verify)" }, turkey: {}, fruit: { dietary: "Vegan" },
};

const CATEGORY_HINTS: Record<Category, RegExp> = {
  food: /food|meal|lunch|dinner|breakfast|pasta|salad|sandwich|pizza|fruit|pastry|catering|snack|soup|rice|bread|platter/,
  furniture: /chair|desk|table|sofa|couch|cabinet|bookcase|shel|bed|dresser|furniture|lamp|stool|bench/,
  clothing: /shirt|coat|jacket|hoodie|cloth|apparel|uniform|linen|towel|sweater|pants|jeans|shoe|scarf|dress/,
  other: /monitor|laptop|keyboard|backpack|supplies|book|toy|electronic|printer/,
};

const SAMPLE_SCANS: Record<Category, string> = {
  food: "Sandwich platters, fresh fruit, cookies",
  furniture: "Ergonomic office chairs, steel desks",
  clothing: "Winter coats, hoodies, t-shirts",
  other: "Computer monitors, keyboards, backpacks",
};

export function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  return (Object.keys(CATEGORY_HINTS) as Category[]).find((c) => CATEGORY_HINTS[c].test(t)) ?? "other";
}

function localEvaluate(input: EvaluateInput): EvaluateResult {
  const category = input.category === "auto" ? guessCategory(`${input.description} ${input.fileName ?? ""}`) : input.category;
  // Without OCI vision we cannot see the photo; fall back to the hint, filename, or a representative sample.
  const description = input.description.trim() || (input.category === "auto" ? SAMPLE_SCANS[category] : "");
  const d = description.toLowerCase();
  const count = d.match(/\b(\d{1,4})\b/);
  const quality: QualityCheck = /stain|broken|torn|moldy|mould|expired|spoiled|damaged/.test(d)
    ? { verdict: "Not suitable", notes: "Hint mentions damage or spoilage — inspect before donating." }
    : /worn|scratch|opened|half/.test(d)
      ? { verdict: "Check before pickup", notes: "Some wear or opened packaging noted — recipient should confirm on pickup." }
      : { verdict: "Good to donate", notes: input.imageBase64 ? "Local check only — enable OCI Vision for a photo inspection." : "No issues mentioned." };
  return { category, ...describe(category, description), quality, estimatedQty: count ? +count[1] : undefined };
}

function describe(category: Category, description: string): Omit<EvaluateResult, "category" | "quality" | "estimatedQty"> {
  const d = description.toLowerCase();
  const items = description.split(/,|&|\band\b|;/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
  const cfg = CATEGORIES[category];

  if (category === "food") {
    const allergens = new Set<string>();
    const dietary = new Set<string>();
    for (const [k, v] of Object.entries(KEYWORDS)) {
      if (d.includes(k)) {
        if (v.allergen) allergens.add(v.allergen);
        if (v.dietary) dietary.add(v.dietary);
      }
    }
    const frozen = /frozen|ice cream|popsicle|gelato/.test(d);
    const hot = !frozen && /hot|pasta|soup|rice|curry|warm/.test(d);
    const cold = /salad|sandwich|wrap|dairy|yogurt|sushi|lunch/.test(d);
    const storage = frozen ? "Frozen" : hot ? "Warm/Insulated" : cold ? "Refrigerated" : "Shelf-Stable";
    const shelfLifeHours = frozen ? 2 : hot ? 3 : cold ? 4 : 12;
    return {
      title: items[0] ? `${items.slice(0, 2).join(" & ")} Meal Packets` : "Prepared Meal Packets",
      attributes: { items, allergens: [...allergens], dietary: [...dietary], storage, shelfLifeHours },
      pickupWindowHours: shelfLifeHours,
      summary: `${storage} food, safe for ~${shelfLifeHours}h. ${allergens.size ? `Contains ${[...allergens].join(", ")}.` : "No common allergens detected."}`,
    };
  }
  if (category === "furniture") {
    const heavy = /desk|table|sofa|couch|cabinet|bookcase|bed|dresser/.test(d);
    return {
      title: items[0] ? `${items.slice(0, 2).join(" & ")}` : "Office Furniture",
      attributes: { itemTypes: items, condition: /new/.test(d) ? "Like New" : /worn|scratch/.test(d) ? "Fair" : "Good", needsTruck: heavy, twoPersonLift: heavy, dimensions: heavy ? "Large items — verify doorway clearance" : "Standard / stackable" },
      pickupWindowHours: cfg.pickupWindowHours,
      summary: `${heavy ? "Heavy pieces: truck + 2-person lift required." : "Light pieces: van pickup OK."} Pickup within ${cfg.pickupWindowHours}h.`,
    };
  }
  if (category === "clothing") {
    const season = /coat|jacket|sweater|fleece|scarf/.test(d) ? "Winter" : /short|tee|t-shirt/.test(d) ? "Summer" : "All-season";
    return {
      title: items[0] ? `${items.slice(0, 2).join(" & ")}` : "Clothing & Linens",
      attributes: { garmentTypes: items, sizeRange: "Mixed S–XL", season, condition: /new|tag/.test(d) ? "New" : "Good" },
      pickupWindowHours: cfg.pickupWindowHours,
      summary: `${season} clothing, sorted by type. Pickup within ${cfg.pickupWindowHours}h.`,
    };
  }
  return {
    title: items[0] ?? "Surplus Items",
    attributes: { condition: "Good", notes: description },
    pickupWindowHours: cfg.pickupWindowHours,
    summary: `General surplus items. Pickup within ${cfg.pickupWindowHours}h.`,
  };
}

export function evaluateItems(input: EvaluateInput) {
  return withFallback(
    async () => {
      const local = localEvaluate(input);
      const cat = input.category === "auto" ? null : input.category;
      const prompt = `You are a surplus-donation intake inspector${cat ? ` for a ${CATEGORIES[cat].label} donation` : ""}.
Donor hint: "${input.description}".
${input.imageBase64 ? "Inspect the attached photo: identify every item, count them, and judge whether they are fit to donate (spoilage, stains, tears, broken parts, open packaging). For food, infer allergens and dietary tags (Vegetarian, Vegan, Halal, Gluten-free, Dairy-free) from what is visible." : ""}
Return ONLY JSON: {${cat ? "" : `"category": "food"|"furniture"|"clothing"|"other", `}"title": string, "summary": string, "pickupWindowHours": number,
"quality": {"verdict": "Good to donate"|"Check before pickup"|"Not suitable", "notes": string (one sentence on condition/safety)},
"estimatedQty": number (visible item/portion count, 0 if unknown), "attributes": ${
        !cat
          ? `{"items"?: string[], "allergens"?: string[], "dietary"?: string[], "storage"?: "Refrigerated"|"Frozen"|"Warm/Insulated"|"Shelf-Stable", "shelfLifeHours"?: number, "itemTypes"?: string[], "garmentTypes"?: string[], "condition"?: "New"|"Like New"|"Good"|"Fair", "needsTruck"?: boolean, "twoPersonLift"?: boolean, "dimensions"?: string, "sizeRange"?: string, "season"?: string, "notes"?: string}`
          : cat === "food"
          ? `{"items": string[], "allergens": string[], "dietary": string[], "storage": "Refrigerated"|"Frozen"|"Warm/Insulated"|"Shelf-Stable", "shelfLifeHours": number}`
          : cat === "furniture"
            ? `{"itemTypes": string[], "condition": "New"|"Like New"|"Good"|"Fair", "needsTruck": boolean, "twoPersonLift": boolean, "dimensions": string}`
            : cat === "clothing"
              ? `{"garmentTypes": string[], "sizeRange": string, "season": string, "condition": "New"|"Like New"|"Good"|"Fair"}`
              : `{"condition": "New"|"Like New"|"Good"|"Fair", "notes": string}`
      }}`;
      const out = await ociChat(prompt, {
        model: input.imageBase64 ? env.visionModel : env.textModel,
        image: input.imageBase64 ? { base64: input.imageBase64, mimeType: input.mimeType ?? "image/jpeg" } : undefined,
      });
      const parsed = parseJson<Partial<EvaluateResult>>(out);
      const category = parsed.category && parsed.category in CATEGORIES ? parsed.category : local.category;
      // A photo-based answer replaces the guessed attributes rather than merging with them.
      const base = input.imageBase64 ? {} : local.attributes;
      const verdicts = ["Good to donate", "Check before pickup", "Not suitable"];
      const quality = parsed.quality && verdicts.includes(parsed.quality.verdict) ? parsed.quality : local.quality;
      const estimatedQty = parsed.estimatedQty && parsed.estimatedQty > 0 ? Math.round(parsed.estimatedQty) : local.estimatedQty;
      return { ...local, ...parsed, category, quality, estimatedQty, attributes: { ...base, ...parsed.attributes } };
    },
    () => localEvaluate(input),
  );
}

// ---------- Event screenshot extraction ----------

export interface ExtractedEvent {
  name: string;
  institution: string;
  department: string;
  address: string;
  eventType: EventType;
  start: string; // ISO
  end: string; // ISO
  rsvps: number;
  foodOrdered: number;
  mealDescription: string;
  /** Allergens and dietary labels for the food listed on the menu / catering order. */
  allergens: string[];
  dietary: string[];
  contact: string;
  /** True when nothing could be read from the image; every other field is then empty. */
  unreadable?: boolean;
}

/** Without OCI vision there is no OCR: return nothing rather than invent event details. */
function localExtract(): ExtractedEvent {
  return { name: "", institution: "", department: "", address: "", eventType: "Other", start: "", end: "", rsvps: 0, foodOrdered: 0, mealDescription: "", allergens: [], dietary: [], contact: "", unreadable: true };
}

export function extractEvent(input: { imageBase64: string; mimeType: string }) {
  return withFallback(
    async () => {
      const out = await ociChat(
        `This is a screenshot of an event (invite, flyer, calendar entry, Eventbrite/registration page, or catering order).
Today is ${new Date().toISOString().slice(0, 10)}. Copy ONLY details that are explicitly visible in the image. Never guess or infer:
if a value is not shown, use "" for text or 0 for numbers. Do not estimate food quantities from attendance.
Return ONLY JSON: {"name": string, "institution": string, "department": string, "address": string,
"eventType": "Career Fair"|"Conference"|"Medical Rounds"|"Corporate Event"|"Gala"|"Other",
"start": ISO-8601 datetime or "", "end": ISO-8601 datetime or "", "rsvps": number, "foodOrdered": number,
"mealDescription": string, "contact": string,
"allergens": string[] (only from food listed in the image, from: Gluten, Dairy, Eggs, Peanuts, Tree nuts, Soy, Fish, Shellfish, Sesame),
"dietary": string[] (only labels stated in the image, from: Vegetarian, Vegan, Halal, Kosher, Gluten-free, Dairy-free)}`,
        { model: env.visionModel, image: { base64: input.imageBase64, mimeType: input.mimeType } },
      );
      const parsed = parseJson<Partial<ExtractedEvent>>(out);
      const kept = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== "" && v !== 0 && v != null && !(Array.isArray(v) && !v.length)));
      return { ...localExtract(), ...kept, unreadable: Object.keys(kept).length === 0 } as ExtractedEvent;
    },
    () => localExtract(),
  );
}

// ---------- Pre-event surplus forecast ----------

export interface ForecastInput {
  rsvps: number;
  foodOrdered: number;
  eventType: EventType;
  weather?: Weather;
}

function localForecast(input: ForecastInput) {
  const p = predictSurplus(input);
  return {
    ...p,
    rationale: `${input.eventType} events average ${Math.round(p.noShow * 100)}% no-show${input.weather && input.weather !== "Clear" ? ` (adjusted for ${input.weather.toLowerCase()})` : ""}. Expect ~${p.expectedAttendance} attendees for ${input.foodOrdered} portions → ~${p.surplus} surplus.`,
  };
}

export function forecastSurplus(input: ForecastInput) {
  return withFallback(
    async () => {
      const base = localForecast(input);
      const text = await ociChat(
        `Explain in one sentence for event staff why a ${input.eventType} with ${input.rsvps} RSVPs and ${input.foodOrdered} portions ordered is forecast to have ${base.surplus} leftover portions (no-show rate ${Math.round(base.noShow * 100)}%, weather ${input.weather ?? "Clear"}).`,
        { model: env.textModel },
      );
      return { ...base, rationale: text.trim() || base.rationale };
    },
    () => localForecast(input),
  );
}

// ---------- Select AI-style impact narrative ----------

export interface ImpactInput {
  stats: ImpactStats;
  donors: string[];
  recipients: string[];
  /** Recipients never see donor tax figures. */
  audience?: "donor" | "recipient";
}

function localImpact({ stats, donors, recipients, audience }: ImpactInput) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const cats = Object.entries(stats.byCategory)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `- **${CATEGORIES[c as Category].label}:** ${n.toLocaleString()} ${CATEGORIES[c as Category].unit}`)
    .join("\n");
  return {
    markdown: `# Not Wasted — Executive Sustainability Summary
_Surplus saved · Generated ${date}_

## Headline
Across ${donors.length} institutional donors and ${recipients.length} verified recipient organizations, the network redirected **${stats.totalItems.toLocaleString()} units of surplus** away from landfill, diverting **${stats.lbs.toLocaleString()} lbs** and preventing an estimated **${stats.co2eKg.toLocaleString()} kg CO2e**.

## Rescued by category
${cats || "- No claims yet"}

## Operations
- Average time-to-claim after broadcast: **${stats.avgTimeToClaim} min**
- Handoffs verified: **${stats.pickedUp}** · open pickups: **${stats.openClaims}**
- Claims that fell through (missed pickup window): **${stats.fellThrough}**

${audience === "recipient" ? `## Liability
Donations are protected under the Bill Emerson Good Samaritan Food Donation Act.
` : `## Donor tax benefit (estimate)
Estimated deductible value: **$${stats.deduction.toLocaleString()}** (food under IRS §170(e)(3) enhanced deduction; goods at fair-market value). Donors are protected under the Bill Emerson Good Samaritan Food Donation Act. Consult a tax advisor.
`}
## Participants
**Donors:** ${donors.join(", ")}
**Recipients:** ${recipients.join(", ")}

## Recommendation
Pre-register recurring events so food banks can reserve fridge space from forecasts, and route bulky furniture through hub pickups to cut fell-through claims.
`,
  };
}

export function generateImpactSummary(input: ImpactInput) {
  return withFallback(
    async () => {
      const markdown = await ociChat(
        input.audience === "recipient"
          ? `Act as Oracle Autonomous Database Select AI (NARRATE). Write a concise sustainability summary in Markdown for a food bank in the "Not Wasted" surplus network. Data: ${JSON.stringify({ ...input, stats: { ...input.stats, deduction: undefined } })}. Include headline impact, per-category rescue, operations KPIs and one recommendation. Do NOT mention tax deductions or donor tax benefits.`
          : `Act as Oracle Autonomous Database Select AI (NARRATE). Write a concise executive sustainability summary in Markdown for the "Not Wasted" surplus network (tagline "Surplus saved"). Data: ${JSON.stringify(input)}. Include headline impact, per-category rescue, operations KPIs, estimated tax benefit (IRS 170(e)(3) for food, FMV for goods) with a disclaimer, and one recommendation.`,
        { model: env.textModel },
      );
      if (!markdown.trim()) throw new Error("Empty narrative");
      return { markdown };
    },
    () => localImpact(input),
  );
}

// ---------- Recipient assistant (chat + voice) ----------

export interface AssistantDonation {
  id: string;
  title: string;
  category: Category;
  remaining: number;
  unit: string;
  institution: string;
  pickupInMinutes: number;
  items: string[];
  allergens: string[];
  dietary: string[];
  storage?: string;
  quality?: string;
  dietaryConflicts: string[];
  matchScore: number;
}

export interface AssistantInput {
  question: string;
  history: ChatTurn[];
  org: { name: string; type: string; requirements: string; accepts: Category[]; capacity: Partial<Record<Category, number>> };
  donations: AssistantDonation[];
}

const fmtMinutes = (m: number) => (m >= 120 ? `${Math.round(m / 60)}h` : `${Math.max(0, Math.round(m))} min`);
const line = (d: AssistantDonation) =>
  `**${d.title}** — ${d.remaining} ${d.unit} from ${d.institution}, pick up within ${fmtMinutes(d.pickupInMinutes)}${d.dietaryConflicts.length ? ` ⚠️ ${d.dietaryConflicts.join("; ")}` : ""}`;

function localAssistant({ question, org, donations }: AssistantInput) {
  const q = question.toLowerCase();
  const live = donations.filter((d) => d.remaining > 0);
  const wantCat = (Object.keys(CATEGORIES) as Category[]).find((c) => q.includes(c) || (c === "food" && /meal|eat|lunch|dinner|breakfast|snack/.test(q)) || (c === "clothing" && /coat|cloth|shirt|towel|linen/.test(q)) || (c === "furniture" && /chair|desk|bed|table|sofa/.test(q)));
  const diet = /vegetarian|vegan|halal|nut|gluten|dairy|pork|diabet|allerg/.exec(q)?.[0];
  let pool = wantCat ? live.filter((d) => d.category === wantCat) : live.filter((d) => org.accepts.includes(d.category));
  if (diet) pool = pool.filter((d) => !d.dietaryConflicts.length && ![...d.allergens, ...d.dietary].some((t) => t.toLowerCase().includes("nut") && diet === "nut"));
  pool = [...pool].sort((a, b) => b.matchScore - a.matchScore);

  if (!live.length) return { reply: "Nothing is available right now. I'll keep watching and you'll be notified as soon as a donor broadcasts something you accept." };
  if (/urgent|soon|expir|first|hurry/.test(q)) {
    const soon = [...pool].sort((a, b) => a.pickupInMinutes - b.pickupInMinutes).slice(0, 3);
    return { reply: soon.length ? `Most time-sensitive for ${org.name}:\n${soon.map((d) => `- ${line(d)}`).join("\n")}` : "Nothing time-sensitive matches right now." };
  }
  if (!pool.length) return { reply: `I couldn't find anything matching that${diet ? ` (${diet})` : ""} right now. ${live.length} other donation${live.length === 1 ? " is" : "s are"} live — ask me for a summary to see them.` };
  const top = pool.slice(0, 4);
  const safe = top.filter((d) => !d.dietaryConflicts.length);
  return {
    reply: `${wantCat || diet ? "Here's what fits" : `Here's what's available for ${org.name}`}${diet ? ` (filtered for ${diet})` : ""}:\n${top.map((d) => `- ${line(d)}`).join("\n")}${safe[0] ? `\n\nBest fit: **${safe[0].title}** (match ${safe[0].matchScore}%). Open it in "Available now" to claim.` : ""}`,
  };
}

export function askAssistant(input: AssistantInput) {
  return withFallback(
    async () => {
      const reply = await ociChat(input.question, {
        model: env.textModel,
        history: input.history.slice(-8),
        system: `You are the Not Wasted intake assistant for ${input.org.name} (${input.org.type}), a recipient in a surplus-donation network in Nashville.
Their stated requirements: "${input.org.requirements || "none stated"}". They accept: ${input.org.accepts.join(", ")}. Remaining storage capacity: ${JSON.stringify(input.org.capacity)}.
Live donations right now (JSON, dietaryConflicts were computed against their requirements from computer-vision tags): ${JSON.stringify(input.donations)}.
Help them decide what to claim: summarize, filter by dietary needs, flag conflicts and pickup deadlines, and suggest quantities within capacity.
Be concise (under 120 words), use short Markdown bullet lists, and only mention donations that appear in the data. You cannot claim on their behalf — tell them to use the Claim button.`,
      });
      if (!reply.trim()) throw new Error("Empty reply");
      return { reply: reply.trim() };
    },
    () => localAssistant(input),
  );
}

// ---------- Outreach agent: email drafts to event organizers ----------

export interface OutreachInput {
  event: { name: string; organizer: string; organizerEmail: string; venue: string; start: string; attendees: number; catering: string; predictedSurplus: number; source: string };
  sender: { orgName: string; contactName: string; role: "donor" | "recipient"; requirements?: string };
}

function localOutreach({ event, sender }: OutreachInput) {
  const when = new Date(event.start).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const first = event.organizer.split(/[,—-]/)[0].trim();
  const ask =
    sender.role === "recipient"
      ? `${sender.orgName} would be glad to collect any leftover food after the event. Our forecast suggests roughly ${event.predictedSurplus} portions may be left over based on ${event.attendees} expected attendees. We can arrange pickup within 30 minutes of the event ending${sender.requirements ? `, and we'd especially welcome items that fit our guests' needs (${sender.requirements.split(".")[0].toLowerCase()})` : ""}.`
      : `I coordinate surplus redistribution for ${sender.orgName} through Not Wasted. Our forecast suggests roughly ${event.predictedSurplus} of the ${event.catering.toLowerCase()} portions may go unused based on ${event.attendees} expected attendees. If you register the event with us, nearby food banks get notified 45 minutes before it ends and pick up the surplus — no work on your side beyond confirming the count.`;
  return {
    subject: `Leftover food from ${event.name}? Let's get it to neighbors in need`,
    body: `Hi ${first} team,

I saw ${event.name} on ${when} at ${event.venue} (via ${event.source}).

${ask}

Donations are covered by the Bill Emerson Good Samaritan Food Donation Act, and food donations may qualify for an enhanced tax deduction.

Would you be open to a quick reply confirming? Happy to share details.

Thank you,
${sender.contactName}
${sender.orgName}`,
  };
}

export function draftOutreach(input: OutreachInput) {
  return withFallback(
    async () => {
      const out = await ociChat(
        `Draft a short, warm outreach email (under 170 words) from ${input.sender.contactName} at ${input.sender.orgName} (${input.sender.role === "recipient" ? "a food bank / community recipient" : "an institutional donor coordinator"}) to the organizer of this upcoming event, asking to redirect leftover catering to people in need through the Not Wasted network.
Event: ${JSON.stringify(input.event)}.${input.sender.requirements ? ` Sender requirements: "${input.sender.requirements}".` : ""}
Mention the forecast surplus, a fast pickup, and Good Samaritan Act liability protection. Return ONLY JSON: {"subject": string, "body": string}`,
        { model: env.textModel },
      );
      const parsed = parseJson<{ subject?: string; body?: string }>(out);
      if (!parsed.subject || !parsed.body) throw new Error("Incomplete draft");
      return { subject: parsed.subject, body: parsed.body };
    },
    () => localOutreach(input),
  );
}

// ---------- Generic agent writing step ----------

/** One AI-written text for an agent (SMS, checklist, letter…); `local` is the deterministic fallback. */
export function writeWithAI(prompt: string, local: () => string) {
  return withFallback(
    async () => {
      const text = (await ociChat(prompt, { model: env.textModel })).trim();
      if (!text) throw new Error("Empty text");
      return { text };
    },
    () => ({ text: local() }),
  );
}

/** Same as writeWithAI but expects a JSON object back; merges over the local result so fields are never missing. */
export function writeJsonWithAI<T extends object>(prompt: string, local: () => T) {
  return withFallback(
    async () => ({ ...local(), ...parseJson<Partial<T>>(await ociChat(prompt, { model: env.textModel })) }) as T,
    local,
  );
}
