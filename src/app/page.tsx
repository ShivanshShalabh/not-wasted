"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { Toaster } from "@/components/Toaster";
import { DonorPortal } from "@/components/donor/DonorPortal";
import { RecipientPortal } from "@/components/recipient/RecipientPortal";
import { ImpactDashboard } from "@/components/impact/ImpactDashboard";
import { useAreaNeeds } from "@/components/useAreaNeeds";
import { useNotWasted } from "@/context/NotWastedContext";
import { currentAccount } from "@/lib/auth";

export default function Home() {
  const { state } = useNotWasted();
  const me = currentAccount(state);
  useAreaNeeds();

  return (
    <>
      <AnimatePresence mode="wait">
        {!me ? (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AuthScreen />
          </motion.div>
        ) : (
          <motion.div key={`app-${me.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <a href="#main" className="sr-only z-50 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
            <AppHeader />
            <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-5 pb-20 pt-10 outline-none">
              <AnimatePresence mode="wait">
                <motion.div key={state.view} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}>
                  {state.view === "impact" ? <ImpactDashboard /> : me.role === "donor" ? <DonorPortal /> : <RecipientPortal />}
                </motion.div>
              </AnimatePresence>
            </main>
            <footer className="relative border-t border-brand-100/70 py-8 text-center text-xs text-stone-500">Not Wasted · Surplus saved · Powered by Oracle Cloud Infrastructure</footer>
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
    </>
  );
}
