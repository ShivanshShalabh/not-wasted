import { Recycle } from "lucide-react";

export function Brand() {
  return (
    <div className="group flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-[0_8px_18px_-8px_rgb(191_83_32/0.7)] transition duration-500 ease-out group-hover:-rotate-12 group-hover:scale-105">
        <Recycle className="h-5 w-5 transition-transform duration-700 ease-out group-hover:rotate-180" />
      </div>
      <div className="text-left leading-none">
        <div className="font-display text-xl font-bold tracking-tight text-ink">Not Wasted</div>
        <div className="mt-1 text-xs font-medium text-brand-700">Surplus saved</div>
      </div>
    </div>
  );
}
