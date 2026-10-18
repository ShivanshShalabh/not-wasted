"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bot, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { AssistantDonation } from "@/lib/oci-service";
import type { RecipientOrg } from "@/lib/types";
import { AiSourceBadge, inputCls } from "../ui";

interface Turn { role: "user" | "assistant"; text: string; source?: "oci" | "local" }

// Minimal Web Speech API surface (not in TS's DOM lib everywhere).
interface RecognitionEvent { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null; onend: (() => void) | null; onerror: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;
const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const SUGGESTIONS = ["Summarize what's available", "Anything vegetarian?", "What expires soonest?", "What should we claim for tonight's dinner?"];

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>));
}

/** Tiny Markdown: **bold** and "- " / "* " bullet lists. */
function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) out.push(<ul key={out.length} className="my-1 list-disc space-y-0.5 pl-4">{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const m = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (m) { bullets.push(m[1]); continue; }
    flush();
    if (line.trim()) out.push(<p key={out.length} className="my-1">{inline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flush();
  return <>{out}</>;
}

const plain = (t: string) => t.replace(/\*\*/g, "").replace(/^\s*[-*•]\s+/gm, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");

export function AssistantPanel({ org, donations }: { org: RecipientOrg; donations: AssistantDonation[] }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const still = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const latest = useRef({ turns, donations, org, busy, speak });
  latest.current = { turns, donations, org, busy, speak };

  useEffect(() => setMicOk(!!recognitionCtor()), []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [turns, busy]);
  useEffect(() => () => { rec.current?.abort(); if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { if (!speak) window.speechSynthesis?.cancel(); }, [speak]);
  useEffect(() => { if (!open) { rec.current?.abort(); window.speechSynthesis?.cancel(); } }, [open]);

  async function ask(question: string) {
    const q = question.trim();
    const { turns, donations, org, busy, speak } = latest.current;
    if (!q || busy) return;
    setDraft("");
    setTurns([...turns, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history: turns.map(({ role, text }) => ({ role, text })),
          org: { name: org.name, type: org.type, requirements: org.requirements ?? "", accepts: org.acceptedCategories, capacity: org.capacity },
          donations,
        }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { reply: string; source: "oci" | "local" };
      setTurns((t) => [...t, { role: "assistant", text: data.reply, source: data.source }]);
      if (speak && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(plain(data.reply)));
      }
    } catch {
      setTurns((t) => [...t, { role: "assistant", text: "Sorry — I couldn't reach the assistant. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) return rec.current?.stop();
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    window.speechSynthesis?.cancel();
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        final ||= e.results[i].isFinal;
      }
      setDraft(text);
      if (final) { r.stop(); void ask(text); }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: 0.96 }}
            onClick={() => setOpen(true)} className="group fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-10px_rgb(191_83_32/0.7)] transition-colors hover:bg-brand-700">
            <Sparkles className="h-4 w-4 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" /> Ask Not Wasted
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside initial={{ x: "100%", opacity: 0.6 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0.6 }} transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/70 bg-paper/95 shadow-2xl backdrop-blur-xl" aria-label="Not Wasted assistant">
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-[0_6px_14px_-6px_rgb(191_83_32/0.6)]"><Bot className="h-5 w-5" /></div>
                <div>
                  <div className="font-display text-lg font-semibold leading-tight">Ask Not Wasted</div>
                  <div className="text-xs text-stone-500">{donations.length} live donation{donations.length === 1 ? "" : "s"} · {org.name}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setSpeak(!speak)} aria-pressed={speak} title={speak ? "Stop reading replies aloud" : "Read replies aloud"}
                  className={`rounded-full p-2 transition ${speak ? "bg-brand-50 text-brand-700" : "text-stone-500 hover:bg-brand-50 hover:text-brand-700"}`}>
                  {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 text-stone-500 transition hover:bg-brand-50 hover:text-brand-700 hover:rotate-90"><X className="h-4 w-4" /></button>
              </div>
            </div>

            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
              {!turns.length && (
                <div className="rounded-3xl bg-white/90 p-4 text-stone-600 shadow-card ring-1 ring-brand-100">
                  Hi! I can see every live donation and your requirements. Ask what fits, what&apos;s expiring, or what to claim{micOk ? " — or tap the mic and just say it" : ""}.
                </div>
              )}
              {turns.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${t.role === "user" ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-white text-stone-800 shadow-card ring-1 ring-brand-100"}`}>
                    {t.role === "user" ? t.text : <Markdown text={t.text} />}
                    {t.source && <div className="mt-1.5 scale-90 origin-left"><AiSourceBadge source={t.source} /></div>}
                  </div>
                </motion.div>
              ))}
              {busy && (
                <div className="flex gap-1 px-1 py-2">
                  {[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-brand-500" animate={still ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ repeat: still ? 0 : Infinity, duration: 1, delay: i * 0.15 }} />)}
                </div>
              )}
            </div>

            <div className="border-t border-stone-100 px-4 pb-4 pt-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} disabled={busy} onClick={() => ask(s)} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200 transition hover:-translate-y-px hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200 disabled:opacity-40">{s}</button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); void ask(draft); }} className="flex items-center gap-2">
                {micOk && (
                  <motion.button type="button" onClick={toggleMic} whileTap={{ scale: 0.92 }} aria-label={listening ? "Stop listening" : "Speak your question"}
                    className={`relative shrink-0 rounded-full p-2.5 ${listening ? "bg-red-500 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-brand-50 hover:text-brand-700"}`}>
                    {listening && !still && <motion.span className="absolute inset-0 rounded-full bg-red-400" animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ repeat: Infinity, duration: 1.2 }} />}
                    {listening ? <MicOff className="relative h-4 w-4" /> : <Mic className="relative h-4 w-4" />}
                  </motion.button>
                )}
                <input className={inputCls} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={listening ? "Listening…" : "Ask about donations…"} />
                <button disabled={busy || !draft.trim()} className="shrink-0 rounded-full bg-brand-600 p-2.5 text-white transition hover:-translate-y-0.5 hover:bg-brand-700 active:scale-95 disabled:opacity-40 disabled:hover:translate-y-0" aria-label="Send"><Send className="h-4 w-4" /></button>
              </form>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
