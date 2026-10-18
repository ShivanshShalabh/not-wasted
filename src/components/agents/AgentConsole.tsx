"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Cloud, LogIn } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { currentAccount } from "@/lib/auth";
import { Brand } from "../Brand";
import { OutreachAgent } from "../agent/OutreachAgent";
import { Toaster } from "../Toaster";
import { btn, EmptyState, PageHeader } from "../ui";
import { useAreaNeeds } from "../useAreaNeeds";
import { ForecastPanel } from "./panels/ForecastPanel";
import { IntakePanel } from "./panels/IntakePanel";
import { ReportPanel } from "./panels/ReportPanel";
import { RescuePanel } from "./panels/RescuePanel";
import { RoutePanel } from "./panels/RoutePanel";
import { SplitPanel } from "./panels/SplitPanel";
import { OciArchitecture } from "../impact/OciArchitecture";
import { AGENTS, type AgentId } from "./registry";

type View = AgentId | "oci";

const PANELS: Record<View, () => React.ReactNode> = {
  oci: () => <OciArchitecture />,
  outreach: () => <OutreachAgent />,
  rescue: () => <RescuePanel />,
  route: () => <RoutePanel />,
  intake: () => <IntakePanel />,
  forecast: () => <ForecastPanel />,
  report: () => <ReportPanel />,
  split: () => <SplitPanel />,
};

export function AgentConsole() {
  const { state } = useNotWasted();
  const me = currentAccount(state);
  useAreaNeeds();
  const [active, setActive] = useState<View>("rescue");

  // Deep links: /agents?agent=route
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("agent") as View | null;
    if (a && a in PANELS) setActive(a);
  }, []);
  const pick = (id: View) => {
    setActive(id);
    window.history.replaceState(null, "", `/agents?agent=${id}`);
  };

  const list = me ? [...AGENTS].sort((a, b) => Number(!a.roles.includes(me.role)) - Number(!b.roles.includes(me.role))) : AGENTS;
  // The OCI architecture page sits alongside the agents: it explains what they run on.
  const info = active === "oci"
    ? { name: "OCI architecture", endpoint: "GET /api/agents" }
    : (({ name, endpoint, id }) => ({ name, endpoint: id === "outreach" ? "GET /api/agent/scout" : `POST ${endpoint}` }))(AGENTS.find((a) => a.id === active)!);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-paper/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" aria-label="Back to Not Wasted"><Brand /></Link>
          <div className="flex items-center gap-3">
            {me && <span className="hidden text-sm text-stone-600 sm:inline">Signed in as <b className="text-ink">{me.orgName}</b></span>}
            <Link href="/" className={btn.secondary}><ArrowLeft className="h-4 w-4" /> Back to app</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-5 pb-20 pt-10">
        <PageHeader eyebrow="Agent console" title="Agents that keep" accent="surplus moving." description="Each agent plans with live network data and public datasets, shows its reasoning, and waits for you before acting. Also callable as JSON endpoints under /api/agents." />

        {!me ? (
          <EmptyState icon={<LogIn className="h-6 w-6" />} title="Sign in to use the agents" action={<Link href="/" className={btn.primary}>Go to sign in <ArrowRight className="h-4 w-4" /></Link>}>
            Agents act on your organization's donations and pickups, so they need an account. Sample accounts are on the sign-in page.
          </EmptyState>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            <nav aria-label="Agents" className="space-y-2 lg:sticky lg:top-24 lg:self-start">
              {list.map((a, i) => {
                const Icon = a.icon;
                const on = a.id === active;
                const forYou = a.roles.includes(me.role);
                return (
                  <motion.button key={a.id} onClick={() => pick(a.id)} aria-current={on ? "page" : undefined}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ x: 3 }}
                    className={`group relative flex w-full cursor-pointer items-start gap-3 rounded-3xl p-4 text-left transition ${on ? "bg-white shadow-card ring-1 ring-brand-200" : "hover:bg-white/60"}`}>
                    {on && <motion.span layoutId="agent-active" className="absolute inset-y-4 left-0 w-1 rounded-full bg-brand-600" />}
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition group-hover:rotate-6 ${on ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{a.name}</span>
                      <span className="block text-xs leading-relaxed text-stone-600">{a.tagline}</span>
                      {!forYou && <span className="mt-1 inline-block text-[11px] text-stone-400">Mostly for {a.roles[0]}s</span>}
                    </span>
                  </motion.button>
                );
              })}
              <div className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-stone-500">Platform</div>
              <motion.button onClick={() => pick("oci")} aria-current={active === "oci" ? "page" : undefined} whileHover={{ x: 3 }}
                className={`group relative flex w-full cursor-pointer items-start gap-3 rounded-3xl p-4 text-left transition ${active === "oci" ? "bg-white shadow-card ring-1 ring-brand-200" : "hover:bg-white/60"}`}>
                {active === "oci" && <motion.span layoutId="agent-active" className="absolute inset-y-4 left-0 w-1 rounded-full bg-brand-600" />}
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition group-hover:rotate-6 ${active === "oci" ? "bg-brand-600 text-white" : "bg-sage-100 text-sage-700"}`}><Cloud className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">OCI architecture</span>
                  <span className="block text-xs leading-relaxed text-stone-600">How the agents run on Oracle Cloud</span>
                </span>
              </motion.button>
            </nav>

            <section aria-labelledby="agent-title" className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="agent-title" className="font-display text-3xl font-semibold tracking-tight">{info.name}</h2>
                    <code className="rounded-full bg-white/70 px-3 py-1 text-xs text-stone-600 ring-1 ring-stone-200">{info.endpoint}</code>
                  </div>
                  {PANELS[active]()}
                </motion.div>
              </AnimatePresence>
            </section>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
