import { NextResponse } from "next/server";
import { generateImpactSummary, ociStatus, type ImpactInput } from "@/lib/oci-service";

export async function POST(req: Request) {
  const body = (await req.json()) as ImpactInput;
  if (!body?.stats) return NextResponse.json({ error: "Missing stats" }, { status: 400 });
  return NextResponse.json(await generateImpactSummary({ stats: body.stats, donors: body.donors ?? [], recipients: body.recipients ?? [], audience: body.audience === "recipient" ? "recipient" : "donor" }));
}

export function GET() {
  return NextResponse.json(ociStatus());
}
