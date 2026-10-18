"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown, ArrowRight, BellRing, CalendarPlus, Camera, Handshake, MapPin, ScanLine, Trash2, Truck } from "lucide-react";
import { useRef } from "react";
import { LOGO_GREEN, LOGO_ORANGE, LOGO_PARTS, LOGO_VIEWBOX } from "../Logo";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const MOTION = "(prefers-reduced-motion: no-preference)";

// Phones resize the viewport as the address bar shows and hides; don't re-pin on that.
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * Scroll-told story under the landing hero: the moment food gets binned, the scale of it,
 * how Not Wasted changes that moment, and who it connects. Everything renders statically
 * first; GSAP adds the pinned, scrubbed scenes on every screen size when motion is allowed.
 */
export function LandingStory({ onStart, onRegister }: { onStart: () => void; onRegister: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // ---------- Pinned, scrubbed scenes (created first so later triggers account for pin spacing) ----------
      mm.add(MOTION, () => {
        // Scene 1 — the moment: the event ends, the food heads for the bin, then the rewind.
        const boxes = gsap.utils.toArray<HTMLElement>("[data-box]");
        // Distances follow the stage, so the same choreography fits a phone and a desktop.
        const stage = root.current!.querySelector<HTMLElement>("[data-stage]")!;
        const sw = (f: number) => () => stage.offsetWidth * f;
        const sh = (f: number) => () => stage.offsetHeight * f;
        gsap.set("[data-caption]", { display: "block", opacity: 0, y: 20 });
        gsap.set("[data-truck]", { display: "flex" });
        const moment = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: "[data-scene='moment']", start: "top top", end: "+=260%", scrub: 0.8, pin: true, anticipatePin: 1 },
        });
        moment
          .from("[data-line='1']", { opacity: 0, y: 30, duration: 0.5 })
          .from("[data-line='2']", { opacity: 0, y: 30, duration: 0.5 }, "+=0.2")
          .from("[data-line='3']", { opacity: 0, y: 30, duration: 0.5 }, "+=0.2")
          .to("[data-clock]", { rotate: 300, duration: 1.4, transformOrigin: "50% 100%" }, 0)
          .to(boxes, { x: sw(0.33), y: sh(0.33), rotate: 18, opacity: 0.35, filter: "grayscale(1)", stagger: 0.06, duration: 0.9 }, "+=0.3")
          .to("[data-bin]", { scale: 1.12, duration: 0.3, yoyo: true, repeat: 1 }, "<0.5")
          .to("[data-caption='binned']", { opacity: 1, y: 0, duration: 0.4 }, "<")
          .to("[data-caption='binned']", { opacity: 0, y: -20, duration: 0.4 }, "+=0.5")
          .to("[data-caption='rewind']", { opacity: 1, y: 0, duration: 0.4 })
          .to(boxes, { x: 0, y: 0, rotate: 0, opacity: 1, filter: "grayscale(0)", stagger: 0.04, duration: 0.7 }, "<")
          .to("[data-bin]", { opacity: 0.25, duration: 0.4 }, "<")
          .to(boxes, { x: sw(0.6), y: -30, opacity: 0, stagger: 0.04, duration: 0.8 }, "+=0.2")
          .from("[data-truck]", { x: -120, opacity: 0, duration: 0.6 }, "<")
          .to("[data-truck]", { x: sw(0.22), duration: 0.8 })
          .to("[data-caption='rewind']", { opacity: 0, duration: 0.3 })
          .to("[data-caption='saved']", { opacity: 1, y: 0, duration: 0.4 }, "<");

        // Scene 3 — how it works: four steps, one phone, a progress line that draws as you scroll.
        const steps = gsap.utils.toArray<HTMLElement>("[data-step]");
        const screens = gsap.utils.toArray<HTMLElement>("[data-screen]");
        gsap.set(screens.slice(1), { opacity: 0, y: 40 });
        gsap.set(steps.slice(1), { opacity: 0.35 });
        const how = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: { trigger: "[data-scene='how']", start: "top top", end: "+=320%", scrub: 0.8, pin: true, anticipatePin: 1 },
        });
        how.fromTo("[data-progress]", { scaleY: 0 }, { scaleY: 1, ease: "none", duration: 4 }, 0);
        for (let i = 1; i < screens.length; i++) {
          const at = i;
          how
            .to(screens[i - 1], { opacity: 0, y: -40, scale: 0.96, duration: 0.35 }, at - 0.2)
            .to(screens[i], { opacity: 1, y: 0, duration: 0.35 }, at)
            .to(steps[i - 1], { opacity: 0.35, duration: 0.3 }, at - 0.2)
            .to(steps[i], { opacity: 1, duration: 0.3 }, at);
        }
        // Inner details of each screen
        how
          .from("[data-field]", { scaleX: 0, transformOrigin: "left center", stagger: 0.15, duration: 0.5 }, 0.05)
          .from("[data-ping]", { y: -60, opacity: 0, duration: 0.4, ease: "back.out(2)" }, 1.1)
          .fromTo("[data-scan]", { yPercent: -10 }, { yPercent: 950, duration: 0.6, ease: "none" }, 2.05)
          .from("[data-tag]", { scale: 0, opacity: 0, stagger: 0.08, duration: 0.25, ease: "back.out(2)" }, 2.4)
          .from("[data-route]", { strokeDashoffset: 300, duration: 0.6, ease: "none" }, 3.1)
          .from("[data-match]", { scale: 0, opacity: 0, duration: 0.3, ease: "back.out(2)" }, 3.55);

        // Scene 4 — the handshake: the donor's hand and the food bank's hand meet around the seed.
        const meet = gsap.timeline({
          scrollTrigger: { trigger: "[data-scene='meet']", start: "top top", end: "+=180%", scrub: 0.8, pin: true, anticipatePin: 1 },
        });
        meet
          .fromTo("[data-hand='donor']", { x: -380, rotate: -25, opacity: 0 }, { x: 0, rotate: 0, opacity: 1, duration: 1 }, 0)
          .fromTo("[data-hand='recipient']", { x: 380, rotate: 25, opacity: 0 }, { x: 0, rotate: 0, opacity: 1, duration: 1 }, 0)
          .from("[data-label='donor']", { x: -60, opacity: 0, duration: 0.5 }, 0.3)
          .from("[data-label='recipient']", { x: 60, opacity: 0, duration: 0.5 }, 0.3)
          .fromTo("[data-seedpart]", { y: -260, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "bounce.out" }, 1)
          .from("[data-meet-copy]", { y: 40, opacity: 0, duration: 0.5 }, 1.3);
      });

      // ---------- Reveals and counters ----------
      mm.add(MOTION, () => {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.from(el, { y: 40, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } });
        });
        gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((group) => {
          gsap.from(group.children, { y: 50, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.12, scrollTrigger: { trigger: group, start: "top 80%" } });
        });
        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const to = Number(el.dataset.count);
          const obj = { v: 0 };
          gsap.to(obj, {
            v: to, duration: 2, ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 85%" },
            onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString("en-US"); },
          });
        });
        gsap.to("[data-cue]", { y: 8, repeat: -1, yoyo: true, duration: 0.9, ease: "sine.inOut" });
      });

      // Pinned scenes add scroll length above later sections: order triggers by page position
      // and re-measure once fonts and images have settled.
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      const remeasure = () => ScrollTrigger.refresh();
      window.addEventListener("load", remeasure);
      void document.fonts?.ready.then(remeasure);
      const late = window.setTimeout(remeasure, 1200);

      return () => {
        window.removeEventListener("load", remeasure);
        window.clearTimeout(late);
        mm.revert();
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative">
      {/* Cue */}
      <div className="flex justify-center pb-6">
        <a href="#story" className="flex flex-col items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-brand-700">
          See how it works <ArrowDown data-cue className="h-5 w-5 text-brand-600" />
        </a>
      </div>

      {/* ---------- Scene 1: the moment ---------- */}
      <section id="story" data-scene="moment" aria-label="The problem" className="relative flex min-h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-5 sm:gap-12 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:px-10">
          <div className="space-y-4 sm:space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">Chapter 1 · The moment</p>
            <h2 className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight text-ink sm:text-5xl [@media(max-height:640px)]:text-2xl">
              <span data-line="1" className="block">8:47 PM. The career fair just ended.</span>
              <span data-line="2" className="block text-brand-600">120 boxed lunches are left.</span>
              <span data-line="3" className="block text-stone-500">Staff need to lock up in 15 minutes.</span>
            </h2>
            <div className="relative h-24 text-base leading-relaxed text-stone-700 sm:text-lg">
              <p data-caption="binned" className="absolute inset-0">Nobody knows which pantry can take it tonight, or who would drive it there. <b className="text-ink">So it goes in the bin.</b></p>
              <p data-caption="rewind" className="absolute inset-0 hidden"><b className="text-brand-700">Now rewind.</b> Not Wasted lined up a food bank and a pickup <i>before</i> the event ended.</p>
              <p data-caption="saved" className="absolute inset-0 hidden"><b className="text-sage-700">Same night, same food — on its way to people who need it.</b></p>
            </div>
          </div>

          {/* Stage */}
          <div aria-hidden data-stage className="relative h-[16rem] rounded-[2rem] sm:h-[26rem] [@media(max-height:640px)]:h-[12.5rem] border border-white/70 bg-white/60 shadow-card backdrop-blur-xl">
            <div className="absolute left-4 top-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-card sm:left-8 sm:top-8">
              <span className="relative h-9 w-9 rounded-full border-2 border-ink/80">
                <span data-clock className="absolute bottom-1/2 left-1/2 h-3.5 w-0.5 -translate-x-1/2 rounded bg-brand-600" />
                <span className="absolute bottom-1/2 left-1/2 h-2.5 w-0.5 origin-bottom -translate-x-1/2 rotate-90 rounded bg-ink" />
              </span>
              <span className="text-sm font-semibold text-ink">Event over</span>
            </div>
            {/* table + boxes */}
            <div className="absolute bottom-6 left-4 w-[55%] sm:bottom-24 sm:left-8">
              <div className="grid grid-cols-4 gap-2.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} data-box className="aspect-[4/3] rounded-xl bg-gradient-to-br from-brand-200 to-brand-500 shadow-sm ring-1 ring-brand-600/20">
                    <div className="mx-auto mt-2 h-1 w-1/2 rounded bg-white/70" />
                  </div>
                ))}
              </div>
              <div className="mt-2 h-3 rounded-full bg-[#7a5a44]" />
              <div className="mx-6 flex justify-between"><span className="h-8 w-2.5 rounded-b bg-[#7a5a44] sm:h-16" /><span className="h-8 w-2.5 rounded-b bg-[#7a5a44] sm:h-16" /></div>
            </div>
            {/* bin */}
            <div data-bin className="absolute bottom-6 right-5 flex h-20 w-16 items-center sm:bottom-10 sm:right-10 sm:h-28 sm:w-24 justify-center rounded-b-2xl rounded-t-md bg-stone-300">
              <Trash2 className="h-8 w-8 text-stone-500 sm:h-10 sm:w-10" />
            </div>
            {/* truck */}
            <div data-truck className="absolute bottom-4 left-1/4 hidden items-center gap-2 whitespace-nowrap rounded-2xl bg-sage-700 px-3 py-2 text-xs sm:bottom-8 sm:px-4 sm:py-2.5 sm:text-sm font-semibold text-white shadow-lift">
              <Truck className="h-5 w-5" /> To Second Harvest
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Scene 2: the scale ---------- */}
      <section aria-label="The scale" className="mx-auto max-w-7xl px-5 py-28 sm:px-8 lg:px-10">
        <p data-reveal className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">Chapter 2 · The scale</p>
        <h2 data-reveal className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">It happens across Nashville <span className="text-brand-600">every week.</span></h2>
        <div data-stagger className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { n: 324, pre: "", suf: "", label: "schools and universities in the Nashville area the EPA lists as excess-food generators" },
            { n: 10634, pre: "up to ", suf: " tons", label: "of excess food a year from those institutions — EPA estimates range from 1,990 to 10,634" },
            { n: 17, pre: "", suf: "", label: "food banks, pantries and soup kitchens on the same map, ready to receive it" },
          ].map((s) => (
            <div key={s.label} className="rounded-3xl border border-white/70 bg-white/85 p-8 shadow-card backdrop-blur-xl">
              <div className="font-display text-5xl font-semibold text-brand-600 tabular">{s.pre}<span data-count={s.n}>{s.n.toLocaleString("en-US")}</span>{s.suf}</div>
              <p className="mt-4 text-base leading-relaxed text-stone-600">{s.label}</p>
            </div>
          ))}
        </div>
        <p data-reveal className="mt-6 text-sm text-stone-500">Source: U.S. EPA Excess Food Opportunities Map, pulled live by the app.</p>
      </section>

      {/* ---------- Scene 3: how it works ---------- */}
      <section data-scene="how" aria-label="How it works" className="relative flex min-h-screen items-center">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-4 px-5 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:px-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">Chapter 3 · How it works</p>
            <h2 className="mt-3 font-display text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-5xl">Predict. Match. Move. <span className="text-brand-600">Before teardown.</span></h2>
            <div className="relative mt-5 pl-8 lg:mt-10">
              <span className="absolute bottom-2 left-[11px] top-2 w-0.5 rounded bg-brand-100" />
              <span data-progress className="absolute bottom-2 left-[11px] top-2 w-0.5 origin-top rounded bg-brand-600" />
              <ol className="space-y-2.5 lg:space-y-7">
                {[
                  [CalendarPlus, "Register the event", "Time, place, guests and catering. Say whether you'll deliver or need a pickup."],
                  [BellRing, "A ping 45 minutes before it ends", "Confirm what's actually left in one tap, and snap a photo."],
                  [ScanLine, "AI builds the listing", "OCI vision names the items, flags quality and likely allergens. You review every field."],
                  [Handshake, "Matched and moved", "Ranked for nearby food banks by dietary fit, capacity, distance and need. They claim it."],
                ].map(([Icon, h, b], i) => {
                  const I = Icon as typeof CalendarPlus;
                  return (
                    <li key={h as string} data-step className="relative">
                      <span className="absolute -left-8 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white ring-4 ring-paper">{i + 1}</span>
                      <div className="flex items-center gap-2 text-base font-semibold text-ink lg:text-lg"><I className="h-5 w-5 shrink-0 text-brand-600" /> {h as string}</div>
                      {/* Phones show the step titles only; the phone mockup below tells the rest. */}
                      <p className="mt-1 hidden max-w-md text-base leading-relaxed text-stone-600 lg:block">{b as string}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* Phone (scaled down on small screens so the pinned scene fits one viewport) */}
          <div aria-hidden className="mx-auto h-[21rem] w-[12rem] sm:h-[27rem] sm:w-[15rem] lg:h-[34rem] lg:w-[19rem] [@media(max-height:640px)]:h-[16rem] [@media(max-height:640px)]:w-[9rem]">
          <div className="relative h-[34rem] w-[19rem] origin-top-left scale-[0.63] rounded-[2.5rem] border-[10px] border-ink bg-paper shadow-lift sm:scale-[0.79] lg:scale-100 [@media(max-height:640px)]:scale-[0.47]">
            <div className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-ink/80" />
            {/* 1: form */}
            <div data-screen className="absolute inset-0 space-y-4 p-6 pt-10">
              <div className="font-display text-xl font-semibold">Register an event</div>
              {["Boxed lunch leftovers", "Fri 12:00 – 3:00 PM", "300 guests · 400 lunches"].map((f) => (
                <div key={f} className="rounded-2xl bg-white p-3 text-sm text-ink shadow-sm ring-1 ring-stone-200"><div data-field className="truncate">{f}</div></div>
              ))}
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold"><div className="rounded-xl bg-brand-600 p-2.5 text-center text-white">We&apos;ll deliver</div><div className="rounded-xl bg-white p-2.5 text-center ring-1 ring-stone-200">Food bank picks up</div></div>
            </div>
            {/* 2: ping */}
            <div data-screen className="absolute inset-0 p-6 pt-10 opacity-0">
              <div data-ping className="rounded-3xl bg-white p-4 shadow-lift ring-1 ring-brand-100">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-700"><BellRing className="h-4 w-4" /> Not Wasted · now</div>
                <div className="mt-2 font-semibold text-ink">Career Fair ends in 45 min</div>
                <div className="text-sm text-stone-600">How much food is left over?</div>
                <div className="mt-3 flex gap-2"><span className="flex-1 rounded-xl bg-brand-600 py-2 text-center text-sm font-semibold text-white">Confirm leftovers</span></div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 py-10 text-sm text-stone-500"><Camera className="h-5 w-5" /> Snap a photo</div>
            </div>
            {/* 3: scan */}
            <div data-screen className="absolute inset-0 p-6 pt-10 opacity-0">
              <div className="relative h-44 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-100 via-brand-200 to-sage-100">
                <div className="grid h-full grid-cols-3 gap-2 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-lg bg-brand-500/50" />)}</div>
                <div data-scan className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-transparent via-white/90 to-transparent" />
              </div>
              <div className="mt-4 font-semibold text-ink">Turkey &amp; veggie wraps</div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
                {[["Refrigerated", "bg-sky-50 text-sky-800"], ["Contains gluten", "bg-red-50 text-red-700"], ["Vegetarian option", "bg-sage-100 text-sage-700"], ["Good to donate", "bg-sage-100 text-sage-700"]].map(([t, c]) => (
                  <span key={t} data-tag className={`rounded-full px-2.5 py-1 ${c}`}>{t}</span>
                ))}
              </div>
            </div>
            {/* 4: match */}
            <div data-screen className="absolute inset-0 p-6 pt-10 opacity-0">
              <div className="relative h-56 rounded-2xl bg-[#fbf3ea] ring-1 ring-brand-100">
                <svg viewBox="0 0 200 160" className="absolute inset-0 h-full w-full">
                  <path data-route d="M40 120 C 70 80, 110 110, 150 40" stroke={LOGO_ORANGE} strokeWidth="3" fill="none" strokeDasharray="300" strokeDashoffset="0" strokeLinecap="round" />
                </svg>
                <span className="absolute left-[16%] top-[70%] flex h-5 w-5 items-center justify-center rounded bg-ink" />
                <span className="absolute left-[73%] top-[20%] h-5 w-5 rounded-full bg-brand-500 ring-4 ring-white" />
                <span className="absolute left-[30%] top-[18%] h-4 w-4 rounded-full bg-brand-200 ring-2 ring-white" />
                <span className="absolute left-[62%] top-[68%] h-4 w-4 rounded-full bg-brand-200 ring-2 ring-white" />
              </div>
              <div data-match className="mt-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-brand-100">
                <div className="flex items-center justify-between"><span className="font-semibold text-ink">Second Harvest</span><span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">91% match</span></div>
                <div className="mt-1 flex items-center gap-1 text-sm text-stone-600"><MapPin className="h-3.5 w-3.5" /> 1.2 mi · claimed 120 lunches</div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ---------- Scene 4: the handshake ---------- */}
      <section data-scene="meet" aria-label="Who it connects" className="relative flex min-h-screen items-center overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-5 text-center sm:px-8 lg:px-10">
          <p data-reveal className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">Chapter 4 · The handshake</p>
          <div className="relative mx-auto mt-10 max-w-3xl sm:mt-24">
            <svg viewBox={LOGO_VIEWBOX} className="mx-auto h-auto w-[min(62vw,30rem)] overflow-visible" aria-hidden>
              <g data-hand="donor"><path d={LOGO_PARTS.donorHand} fill={LOGO_GREEN} /><circle cx="58" cy="59" r="16" fill={LOGO_GREEN} /></g>
              <g data-hand="recipient"><path d={LOGO_PARTS.recipientHand} fill={LOGO_ORANGE} /><circle cx="198" cy="59" r="16" fill={LOGO_ORANGE} /></g>
              <g data-seedpart><path d={LOGO_PARTS.seed} fill={LOGO_ORANGE} /><path d={LOGO_PARTS.leaf} fill={LOGO_GREEN} /></g>
            </svg>
            <div data-label="donor" className="absolute left-0 top-1/2 hidden -translate-x-1/2 rounded-2xl bg-white/90 px-4 py-3 text-left shadow-card md:block">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#165840]">Donors</div>
              <div className="text-sm text-stone-600">Campuses, hospitals, venues</div>
            </div>
            <div data-label="recipient" className="absolute right-0 top-1/2 hidden translate-x-1/2 rounded-2xl bg-white/90 px-4 py-3 text-left shadow-card md:block">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">Food banks</div>
              <div className="text-sm text-stone-600">Pantries, shelters, closets</div>
            </div>
          </div>
          <div data-meet-copy className="mx-auto mt-6 max-w-2xl sm:mt-10">
            <h2 className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-5xl">Two sides of the same table. <span className="text-brand-600">We&apos;re the handshake.</span></h2>
            <p className="mt-4 text-base leading-relaxed text-stone-600 sm:mt-5 sm:text-lg">Donors post in a minute. Food banks see only what fits their kitchen, set their capacity, and claim — or join a waitlist if it&apos;s gone.</p>
          </div>
        </div>
      </section>

      {/* ---------- Scene 5: call to action ---------- */}
      <section aria-label="Get started" className="mx-auto max-w-7xl px-5 pb-28 sm:px-8 lg:px-10">
        <div data-reveal className="relative overflow-hidden rounded-[2.5rem] bg-brand-900 px-8 py-16 text-center text-white shadow-lift sm:px-16">
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-brand-500/40 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-sage-500/30 blur-3xl" />
          <h2 className="relative font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Your next event ends at some point.<br /><span className="text-brand-200">Let&apos;s plan what happens after.</span></h2>
          <div className="relative mt-10 flex flex-wrap justify-center gap-3">
            <button onClick={onStart} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-brand-900 shadow-lift transition hover:-translate-y-0.5 hover:bg-brand-50">
              Log in <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={onRegister} className="inline-flex min-h-12 items-center gap-2 rounded-full border-[1.5px] border-white/60 px-7 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white/10">
              Register your organization
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
