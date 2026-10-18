"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { hashPassword } from "@/lib/auth";
import { btn, Field, inputCls } from "../ui";
import { SAMPLE_ACCOUNTS, SampleAccounts } from "./SampleAccounts";


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function SignIn({ onRegister }: { onRegister: () => void }) {
  const { state, dispatch } = useNotWasted();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function signIn(em: string, pw: string) {
    const acc = state.accounts.find((a) => a.email.toLowerCase() === em.trim().toLowerCase());
    if (!acc || acc.passwordHash !== (await hashPassword(pw))) return setError("Email or password is incorrect.");
    dispatch({ type: "LOGIN", accountId: acc.id });
  }

  /** Types the sample credentials into the form, then signs in. */
  async function typeAndSignIn(em: string, pw: string) {
    setTyping(true);
    setError(null);
    setEmail("");
    setPassword("");
    for (let i = 1; i <= em.length; i++) { setEmail(em.slice(0, i)); await sleep(18); }
    for (let i = 1; i <= pw.length; i++) { setPassword(pw.slice(0, i)); await sleep(30); }
    await sleep(250);
    setTyping(false);
    await signIn(em, pw);
  }

  return (
    <div>
      <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Welcome <span className="text-brand-600">back</span></h2>
      <p className="mt-2 text-[15px] text-stone-600">Sign in to your organization&apos;s account.</p>

      <p className="mt-7 mb-3 text-sm font-medium text-stone-700">Explore with a sample account</p>
      <SampleAccounts disabled={typing} onPick={(em, pw) => void typeAndSignIn(em, pw)} />

      <div className="my-7 flex items-center gap-3 text-xs text-stone-500"><span className="h-px flex-1 bg-stone-200" /> or sign in with email <span className="h-px flex-1 bg-stone-200" /></div>

      <form onSubmit={(e) => { e.preventDefault(); void signIn(email, password); }} className="space-y-4">
        <Field label="Email"><input type="email" required autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input type="password" required autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={typing} className={`${btn.primary} w-full min-h-12`}>Sign in <ArrowRight className="h-4 w-4" /></button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-600">
        New organization? <button onClick={onRegister} className="min-h-11 px-1 font-semibold text-brand-700 underline-offset-4 hover:underline">Create an account</button>
      </p>

      <button onClick={() => setShowAll(!showAll)} className="mx-auto mt-4 flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-medium text-stone-500 transition hover:bg-brand-50 hover:text-brand-700">
        Other demo accounts (Oracle, food banks) <motion.span animate={{ rotate: showAll ? 180 : 0 }}><ChevronDown className="h-3.5 w-3.5" /></motion.span>
      </button>
      {showAll && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 grid gap-2">
          {state.accounts.filter((a) => !SAMPLE_ACCOUNTS.some((s) => s.email === a.email)).map((a) => (
            <button key={a.id} onClick={() => dispatch({ type: "LOGIN", accountId: a.id })} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-2.5 text-left text-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-card hover:ring-brand-500">
              <span className="font-medium">{a.orgName}</span><span className="truncate font-mono text-xs text-stone-500">{a.email}</span>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
