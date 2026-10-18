"use client";

import { Download, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { currentAccount } from "@/lib/auth";
import type { ImpactStats } from "@/lib/impact";
import { AiSourceBadge, btn, Card, SectionTitle } from "../ui";

export function ImpactSummary({ stats }: { stats: ImpactStats }) {
  const { state } = useNotWasted();
  const [out, setOut] = useState<{ markdown: string; source: "oci" | "local" } | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats, donors: [...new Set(state.batches.map((b) => b.institution))], recipients: state.recipients.map((r) => r.name), audience: currentAccount(state)?.role ?? "donor" }),
      });
      setOut(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!out) return;
    const url = URL.createObjectURL(new Blob([out.markdown], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `not-wasted-impact-${new Date().toISOString().slice(0, 10)}.md` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="flex flex-col">
      <SectionTitle hint="A plain-language ESG and Good Samaritan summary written from live claim data" action={out && <AiSourceBadge source={out.source} />}>Executive sustainability report</SectionTitle>
      <div className="mb-5 overflow-x-auto rounded-2xl bg-brand-900 px-4 py-3 font-mono text-xs leading-relaxed text-brand-100">
        SELECT AI NARRATE summarize surplus impact for donors and recipient network this month;
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btn.primary} onClick={generate} disabled={loading}><Sparkles className="h-4 w-4" /> {loading ? "Generating…" : "Generate report"}</button>
        <button className={btn.secondary} onClick={download} disabled={!out}><Download className="h-4 w-4" /> Download .md</button>
      </div>
      <pre className={`mt-5 max-h-[28rem] flex-1 overflow-auto whitespace-pre-wrap rounded-2xl border border-brand-100 bg-white/70 p-5 font-sans text-sm leading-relaxed ${out ? "text-stone-700" : "text-stone-500"}`}>
        {out?.markdown ?? "Press “Generate report” and the summary appears here."}
      </pre>
    </Card>
  );
}
