import { NextResponse } from "next/server";
import { embedTexts } from "@/lib/oci-service";
import { cosine } from "@/lib/semantic";

/** Scores each donation text against each recipient profile with OCI embeddings. */
export async function POST(req: Request) {
  const body = (await req.json()) as { donations?: string[]; recipients?: string[] };
  const donations = (body.donations ?? []).slice(0, 40).map((s) => String(s).slice(0, 1500));
  const recipients = (body.recipients ?? []).slice(0, 40).map((s) => String(s).slice(0, 1500));
  const { vectors, source } = await embedTexts([...donations, ...recipients]);
  if (!vectors) return NextResponse.json({ scores: null, source });
  const d = vectors.slice(0, donations.length);
  const r = vectors.slice(donations.length);
  return NextResponse.json({ scores: d.map((dv) => r.map((rv) => Math.max(0, cosine(dv, rv)))), source });
}
