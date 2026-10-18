"use client";

import { AlarmClock, CalendarDays, CalendarPlus, CheckCircle2, Clock, Truck, Users } from "lucide-react";
import { useNotWasted } from "@/context/NotWastedContext";
import { myDonorData } from "@/lib/auth";
import { countdown, timeOf } from "@/lib/format";
import { Pill } from "../AttributeTags";
import { btn, Card, EmptyState, MotionList } from "../ui";

export function EventList({ onRegister }: { onRegister?: () => void }) {
  const { state, dispatch, now } = useNotWasted();
  const { events } = myDonorData(state);
  if (!events.length) {
    return (
      <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No events yet"
        action={onRegister && <button className={btn.secondary} onClick={onRegister}><CalendarPlus className="h-4 w-4" /> Register your first event</button>}>
        Register a catered event and we'll remind you 45 minutes before it ends so food banks can claim what's left.
      </EmptyState>
    );
  }
  return (
    <MotionList className="space-y-4">
      {events.map((e) => {
        const untilEnd = e.end - now;
        return (
          <Card key={e.id} interactive className="group">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-transform duration-500 ease-out group-hover:-rotate-6 group-hover:scale-110"><CalendarDays className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{e.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-stone-500">
                    <span className="truncate">{e.institution}</span>
                    <span className="inline-flex items-center gap-1 tabular"><Clock className="h-3.5 w-3.5" /> {timeOf(e.start)}–{timeOf(e.end)}</span>
                  </div>
                </div>
              </div>
              <dl className="flex gap-8 text-sm">
                <div>
                  <dt className="flex items-center gap-1 text-stone-500"><Users className="h-3.5 w-3.5" /> RSVPs</dt>
                  <dd className="mt-0.5 font-display text-lg font-semibold leading-tight">{e.rsvps}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-stone-500"><Truck className="h-3.5 w-3.5" /> Leftovers</dt>
                  <dd className="mt-0.5 text-sm font-medium leading-tight text-ink">{e.transport === "Donor delivers" ? "You deliver" : "Food bank picks up"}</dd>
                </div>
              </dl>
              <div className="flex w-44 justify-end">
                {e.batchId ? (
                  <Pill className="!px-2.5 !py-1"><CheckCircle2 className="h-3 w-3" /> Leftovers posted</Pill>
                ) : (
                  <button onClick={() => dispatch({ type: "TRIGGER_PING", eventId: e.id })} title="Confirm how much food is left over"
                    className={btn.secondary}>
                    <AlarmClock className="h-4 w-4" /> {untilEnd > 0 ? <span className="tabular">Ends in {countdown(untilEnd)}</span> : "Confirm leftovers"}
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </MotionList>
  );
}
