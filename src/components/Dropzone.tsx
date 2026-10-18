"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ScanLine, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Drag-and-drop / click / camera image picker with an animated scan overlay while `scanning`. */
export function Dropzone({ file, onFile, scanning, title, hint }: { file: File | null; onFile: (f: File) => void; scanning?: boolean; title: string; hint: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const still = useReducedMotion();

  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <div
      onClick={() => !scanning && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f?.type.startsWith("image/")) onFile(f);
      }}
      role="button" tabIndex={0} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !scanning) { e.preventDefault(); input.current?.click(); } }}
      className={`relative flex min-h-52 cursor-pointer flex-col items-center justify-center overflow-hidden group rounded-3xl border-2 border-dashed transition duration-300 ${over ? "scale-[1.01] border-brand-500 bg-brand-50" : "border-brand-200 bg-white/60 hover:border-brand-500 hover:bg-brand-50/50"}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Uploaded" className="max-h-64 w-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <motion.div animate={still ? undefined : { y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-card ring-1 ring-brand-100 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
            <Upload className="h-5 w-5" />
          </motion.div>
          <div className="mt-1 font-semibold">{title}</div>
          <div className="max-w-xs text-sm text-stone-500">{hint}</div>
        </div>
      )}

      <AnimatePresence>
        {scanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-brand-900/30 backdrop-blur-[1px]">
            <motion.div
              className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-brand-200/70 to-transparent"
              style={still ? { top: "40%" } : undefined}
              animate={still ? undefined : { top: ["-15%", "100%"] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            />
            <div className="absolute inset-x-0 bottom-3 flex justify-center">
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow"><ScanLine className="h-3.5 w-3.5" /> Scanning with OCI AI…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </div>
  );
}
