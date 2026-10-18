"use client";

import { Camera, ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function PhotoPicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-3 transition hover:border-brand-500">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Selected surplus" className="h-16 w-16 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-stone-400">
          <ImageIcon className="h-6 w-6" />
        </div>
      )}
      <div className="text-sm">
        <div className="flex items-center gap-1.5 font-medium text-stone-700">
          <Camera className="h-4 w-4" /> {file ? file.name : "Snap or select a photo (optional)"}
        </div>
        <div className="text-xs text-stone-500">OCI GenAI Vision tags items, condition and handling needs</div>
      </div>
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  );
}
