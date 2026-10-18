import { NextResponse } from "next/server";
import { askAssistant, type AssistantInput } from "@/lib/oci-service";

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<AssistantInput>;
  const question = String(body.question ?? "").trim().slice(0, 1000);
  if (!question || !body.org) return NextResponse.json({ error: "Missing question or org" }, { status: 400 });
  const history = (body.history ?? []).filter((t) => t && (t.role === "user" || t.role === "assistant")).map((t) => ({ role: t.role, text: String(t.text).slice(0, 2000) }));
  return NextResponse.json(await askAssistant({ question, history, org: body.org, donations: (body.donations ?? []).slice(0, 40) }));
}
