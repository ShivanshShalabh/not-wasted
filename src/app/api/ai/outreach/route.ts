import { NextResponse } from "next/server";
import { draftOutreach, type OutreachInput } from "@/lib/oci-service";

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<OutreachInput>;
  if (!body.event?.name || !body.sender?.orgName) return NextResponse.json({ error: "Missing event or sender" }, { status: 400 });
  return NextResponse.json(await draftOutreach(body as OutreachInput));
}
