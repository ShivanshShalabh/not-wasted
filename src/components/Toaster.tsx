"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { useNotWasted } from "@/context/NotWastedContext";

export function Toaster() {
  const { state, dispatch } = useNotWasted();
  const msg = state.lastError ?? state.lastNotice;
  const isError = !!state.lastError;

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => dispatch({ type: isError ? "CLEAR_ERROR" : "CLEAR_NOTICE" }), isError ? 4500 : 2800);
    return () => clearTimeout(t);
  }, [msg, isError, dispatch]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {msg && (
          <motion.div
            role="status"
            aria-live="polite"
            key={msg}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className={`pointer-events-auto flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-medium shadow-lift ring-1 ring-white/10 ${isError ? "bg-red-600 text-white" : "bg-brand-900 text-white"}`}
          >
            {isError ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-sage-500" />}
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
