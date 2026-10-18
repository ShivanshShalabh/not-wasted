import { NextResponse } from "next/server";
import { defaultPickupBy, missingFields, parseDeadline, parseLocation, parseQty, QUESTIONS, type IntakeDraft } from "@/lib/agents/intake";
import { step } from "@/lib/agents/trace";
import { evaluateItems, writeJsonWithAI } from "@/lib/oci-service";

/** Free text → donation draft. AI fills title/category/attributes; regexes catch quantity, deadline and place. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; now?: number };
  const text = String(body.text ?? "").trim().slice(0, 600);
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });
  const now = Number(body.now) || Date.now();

  const ev = await evaluateItems({ category: "auto", description: text });
  const local = { qty: parseQty(text), location: parseLocation(text), pickupTime: "" };
  const extracted = await writeJsonWithAI(
    `Extract from this donor message. Today is ${new Date(now).toString()}. Return ONLY JSON {"qty": number|null, "location": string, "pickupTime": "HH:MM" 24h or ""}. Message: "${text}"`,
    () => local,
  );
  let pickupBy = parseDeadline(text, now);
  if (!pickupBy && /^\d{1,2}:\d{2}$/.test(extracted.pickupTime ?? "")) {
    const [h, m] = extracted.pickupTime.split(":").map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    pickupBy = d.getTime() > now ? d.getTime() : null;
  }

  const draft: IntakeDraft = {
    category: ev.category,
    title: ev.title,
    qty: Number(extracted.qty) > 0 ? Math.round(Number(extracted.qty)) : local.qty,
    location: String(extracted.location || local.location || ""),
    pickupBy,
    attributes: ev.attributes,
    allergensConfirmed: false,
  };
  const missing = missingFields(draft);
  return NextResponse.json({
    draft,
    missing,
    questions: missing.map((f) => ({ field: f, text: QUESTIONS[f] })),
    suggestedPickupBy: defaultPickupBy(draft.category, now),
    steps: [
      step("Reading the message", [`“${text}”`]),
      step("Identifying the donation", [`${ev.title} (${draft.category})`, ev.summary], ev.source === "oci" ? "OCI Generative AI" : undefined),
      step("Extracting details", [`Quantity: ${draft.qty ?? "?"}`, `Place: ${draft.location || "?"}`, `Pickup by: ${pickupBy ? new Date(pickupBy).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "?"}`]),
      step(missing.length ? `${missing.length} thing${missing.length > 1 ? "s" : ""} to confirm` : "Ready to post", missing.map((f) => QUESTIONS[f])),
    ],
    source: ev.source,
  });
}
