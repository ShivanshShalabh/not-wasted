"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlarmClock, Bot, Building2, ChevronDown, HandHeart, LogOut, Network, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { currentAccount, myDonorData } from "@/lib/auth";
import { createSeedState } from "@/lib/seed";
import type { View } from "@/lib/types";
import { Brand } from "./Brand";

export function AppHeader() {
  const { state, dispatch } = useNotWasted();
  const me = currentAccount(state);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pending = myDonorData(state).events.find((e) => !e.batchId);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // Stays mounted during the logout exit animation, after the session is cleared.
  if (!me) return null;

  const nav: { id: View; label: string; icon: typeof Building2 }[] = [
    me.role === "donor" ? { id: "donor", label: "Donor workspace", icon: Building2 } : { id: "recipient", label: "Recipient portal", icon: HandHeart },
    { id: "impact", label: "Network impact", icon: Network },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-paper/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5">
        <Brand />

        <nav aria-label="Main" className="order-3 flex h-12 w-full items-center gap-1 rounded-full border border-white/70 bg-white/70 p-1 shadow-card ring-1 ring-brand-900/[0.05] backdrop-blur-xl md:order-none md:w-auto">
          {nav.map(({ id, label, icon: Icon }) => {
            const active = state.view === id;
            return (
              <button key={id} onClick={() => dispatch({ type: "SET_VIEW", view: id })} aria-current={active ? "page" : undefined}
                className={`group relative flex h-full flex-1 items-center justify-center gap-2 rounded-full px-4 transition-colors md:flex-none ${active ? "" : "hover:bg-brand-50"}`}>
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-brand-600 shadow-[0_8px_18px_-8px_rgb(191_83_32/0.7)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <Icon className={`relative z-10 h-4 w-4 transition-colors ${active ? "text-white" : "text-stone-500 group-hover:-translate-y-px group-hover:text-brand-600"}`} />
                <span className={`relative z-10 whitespace-nowrap text-sm font-medium transition-colors ${active ? "text-white" : "text-stone-600 group-hover:text-ink"}`}>{label}</span>
              </button>
            );
          })}
        </nav>

        <div ref={ref} className="relative ml-auto">
          <button onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu" aria-label={`Account menu for ${me.orgName}`}
            className="flex h-12 items-center gap-2.5 rounded-full border border-white/70 bg-white/70 pl-1.5 pr-4 shadow-card ring-1 ring-brand-900/[0.05] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lift hover:ring-brand-200 active:scale-[0.98]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{me.orgName.slice(0, 1)}</span>
            <span className="hidden max-w-40 truncate text-sm font-medium sm:block">{me.orgName}</span>
            <motion.span animate={{ rotate: menu ? 180 : 0 }}><ChevronDown className="h-4 w-4 text-stone-400" /></motion.span>
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="absolute right-0 mt-2 w-80 origin-top-right overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-lift ring-1 ring-brand-900/[0.06] backdrop-blur-xl">
                <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-600 font-bold text-white">{me.orgName.slice(0, 1)}</span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{me.orgName}</div>
                    <div className="truncate text-sm text-stone-600">{me.role === "donor" ? "Donor" : "Recipient"} · {me.email}</div>
                  </div>
                </div>

                <div className="border-b border-stone-100 p-2">
                  <a href="/agents" className="flex min-h-11 w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-brand-50">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                    <span>
                      <span className="block text-sm font-medium">Agent console</span>
                      <span className="block text-xs text-stone-500">Rescue, routing, intake, forecasting, reports, outreach</span>
                    </span>
                  </a>
                </div>

                {me.role === "donor" && (
                  <div className="border-b border-stone-100 p-2">
                    <div className="px-3 pb-1 pt-1.5 text-xs font-medium text-stone-500">Demo tools</div>
                    <button onClick={() => { dispatch({ type: "TRIGGER_PING" }); setMenu(false); }} disabled={!pending}
                      className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">
                      <AlarmClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        <span className="block text-sm font-medium">Simulate 45-min alert</span>
                        <span className="block text-xs text-stone-500">{pending ? `Pretend "${pending.name}" is about to end` : "Register an event first"}</span>
                      </span>
                    </button>
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto p-2">
                  <div className="px-3 pb-1 pt-1.5 text-xs font-medium text-stone-500">Switch account (demo)</div>
                  {state.accounts.filter((a) => a.id !== me.id).map((a) => (
                    <button key={a.id} onClick={() => { dispatch({ type: "LOGIN", accountId: a.id }); setMenu(false); }} className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition hover:translate-x-0.5 hover:bg-brand-50">
                      {a.role === "donor" ? <Building2 className="h-4 w-4 shrink-0 text-stone-400" /> : <HandHeart className="h-4 w-4 shrink-0 text-brand-600" />}
                      <span className="truncate">{a.orgName}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-stone-100 p-2">
                  <button onClick={() => { dispatch({ type: "RESET", state: createSeedState() }); setMenu(false); }} className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm text-stone-600 transition hover:bg-brand-50"><RotateCcw className="h-4 w-4" /> Reset demo data</button>
                  <button onClick={() => dispatch({ type: "LOGOUT" })} className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"><LogOut className="h-4 w-4" /> Sign out</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
