"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlarmClock, Building2, CalendarPlus, PackagePlus } from "lucide-react";
import { useState } from "react";
import { useNotWasted } from "@/context/NotWastedContext";
import { currentAccount, myDonorData } from "@/lib/auth";
import { countdown } from "@/lib/format";
import { AnimatedNumber, btn, GettingStarted, Modal, PageHeader, Tabs } from "../ui";
import { CreateEventForm } from "./CreateEventForm";
import { EventList } from "./EventList";
import { PostSurplusForm } from "./PostSurplusForm";
import { SplitClaimTracker } from "./SplitClaimTracker";
import { T45PingModal } from "./T45PingModal";

export function DonorPortal() {
  const { state, dispatch, now } = useNotWasted();
  const [tab, setTab] = useState<"donations" | "events">("donations");
  const [modal, setModal] = useState<"event" | "post" | null>(null);
  const pingEvent = state.events.find((e) => e.id === state.pingEventId) ?? null;
  const mine = myDonorData(state);
  const dueSoon = mine.events.find((e) => !e.batchId && e.end - now <= 45 * 60_000 && e.end > now);

  const active = mine.batches.filter((b) => b.status === "AVAILABLE").length;
  const myBatchIds = new Set(mine.batches.map((b) => b.id));
  const claimed = state.claims.filter((c) => c.status !== "CANCELLED" && myBatchIds.has(c.batchId)).reduce((a, c) => a + c.qty, 0);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={<><Building2 className="h-3.5 w-3.5" /> Donor workspace</>}
        title={currentAccount(state)?.orgName ?? "Donor workspace"}
        accent="Surplus, put to use."
        description={<><b className="tabular font-semibold text-ink"><AnimatedNumber value={active} /></b> live donations · <b className="tabular font-semibold text-ink"><AnimatedNumber value={claimed} /></b> units claimed</>}
        actions={<>
          <button className={btn.secondary} onClick={() => setModal("event")}><CalendarPlus className="h-4 w-4" /> Register event</button>
          <button className={btn.primary} onClick={() => setModal("post")}><PackagePlus className="h-4 w-4" /> Post surplus</button>
        </>}
      />

      <GettingStarted id="donor" title="How donating works" steps={[
        { title: "Post surplus", body: "Snap a photo and AI fills in the details: items, allergens, condition and quantity." },
        { title: "Register upcoming events", body: "We remind you 45 minutes before it ends to post what's left." },
        { title: "Track pickups", body: "See which food banks claimed what, and confirm each handoff." },
      ]} />

      <AnimatePresence>
        {dueSoon && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/70 bg-white/85 px-6 py-5 shadow-card ring-1 ring-brand-200 backdrop-blur-xl">
            <span className="relative flex h-3 w-3 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-brand-600" /></span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink">{dueSoon.name} ends in <span className="tabular">{countdown(dueSoon.end - now)}</span></div>
              <p className="mt-0.5 text-sm text-stone-600">Tell us how much food is left so nearby food banks can claim it before it goes to waste.</p>
            </div>
            <button className={`${btn.primary}`} onClick={() => dispatch({ type: "TRIGGER_PING", eventId: dueSoon.id })}>
              <AlarmClock className="h-4 w-4" /> Confirm leftovers
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs id="donor" value={tab} onChange={setTab} items={[
            { value: "donations", label: <>Active donations <span className="tabular text-stone-400">{mine.batches.length}</span></> },
            { value: "events", label: <>Events <span className="tabular text-stone-400">{mine.events.length}</span></> },
          ]} />
          <p className="text-sm text-stone-500">{tab === "donations" ? "Who claimed each donation, and what is still available." : "Events we're watching for leftovers."}</p>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            {tab === "donations" ? <SplitClaimTracker onPost={() => setModal("post")} /> : <EventList onRegister={() => setModal("event")} />}
          </motion.div>
        </AnimatePresence>
      </section>

      <Modal open={modal === "event"} onClose={() => setModal(null)} title="Register an event" wide>
        <CreateEventForm onDone={() => setModal(null)} />
      </Modal>
      <Modal open={modal === "post"} onClose={() => setModal(null)} title="Post surplus">
        <PostSurplusForm onDone={() => setModal(null)} />
      </Modal>
      {pingEvent && <T45PingModal event={pingEvent} />}
    </div>
  );
}
