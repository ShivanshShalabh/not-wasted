"use client";

import { Bot, Download, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { currentAccount } from "@/lib/auth";
import type { ImpactStats } from "@/lib/impact";
import { Markdown } from "../Markdown";
import { AiSourceBadge, btn, Card, EmptyState, SectionTitle } from "../ui";

/**
 * Impact report. Normally written by the Weekly impact report agent (/agents?agent=report);
 * "Generate report" stays as a manual fallback when no agent report exists yet.
 */
export function ImpactSummary({ stats }: { stats: ImpactStats }) {
  const { state, dispatch } = useNotWasted();
  const report = state.latestReport;
  const [busy, setBusy] = useState<"agent" | "manual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAgent() {
    setBusy("agent");
    setError(null);
    try {
      const res = await fetch("/api/agents/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, now: Date.now() }) });
      const d = await res.json();
      if (!res.ok || !d.markdown) throw new Error(d.error ?? "The report agent didn't return a report");
      dispatch({ type: "SAVE_REPORT", report: { markdown: d.markdown, generatedAt: Date.now(), source: d.source ?? "local", by: "agent" } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setBusy("manual");
    setError(null);
    try {
      const res = await fetch("/api/ai/impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats, donors: [...new Set(state.batches.map((b) => b.institution))], recipients: state.recipients.map((r) => r.name), audience: currentAccount(state)?.role ?? "donor" }),
      });
      const d = await res.json();
      if (!res.ok || !d.markdown) throw new Error(d.error ?? "Couldn't generate the report");
      dispatch({ type: "SAVE_REPORT", report: { markdown: d.markdown, generatedAt: Date.now(), source: d.source, by: "manual" } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report.markdown], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `not-wasted-impact-${new Date(report.generatedAt).toISOString().slice(0, 10)}.md` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const when = report && new Date(report.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <Card className="flex flex-col">
      <SectionTitle hint="Written from live claim data by the Weekly impact report agent" action={report && <AiSourceBadge source={report.source} />}>Impact report</SectionTitle>

      <div className="flex flex-wrap items-center gap-2">
        <button className={btn.primary} onClick={runAgent} disabled={!!busy}><Bot className="h-4 w-4" /> {busy === "agent" ? "Agent is writing…" : "Run report agent"}</button>
        <button className={btn.secondary} onClick={generate} disabled={!!busy}><Sparkles className="h-4 w-4" /> {busy === "manual" ? "Generating…" : "Generate report"}</button>
        <button className={btn.ghost} onClick={download} disabled={!report}><Download className="h-4 w-4" /> Download .md</button>
        <Link href="/agents?agent=report" className="ml-auto text-sm font-medium text-brand-700 underline-offset-4 hover:underline">Open the agent →</Link>
      </div>
      {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      <div className="mt-6">
        {report ? (
          <article className="rounded-3xl border border-brand-100 bg-white/80 p-6 sm:p-8">
            <p className="mb-5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              {report.by === "agent" ? <><Bot className="h-3.5 w-3.5 text-brand-600" /> Written by the Weekly impact report agent</> : <><FileText className="h-3.5 w-3.5" /> Generated on demand</>}
              <span aria-hidden>·</span> {when}
            </p>
            <Markdown>{report.markdown}</Markdown>
          </article>
        ) : (
          <EmptyState icon={<Bot className="h-6 w-6" />} title="No report yet">
            The Weekly impact report agent writes this every Monday. Run it now, or generate a one-off report.
          </EmptyState>
        )}
      </div>
    </Card>
  );
}
