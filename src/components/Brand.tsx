import { Logo } from "./Logo";

export function Brand() {
  return (
    <div className="group flex items-center gap-2.5">
      <Logo className="h-9 w-auto drop-shadow-[0_6px_10px_rgb(61_26_12/0.12)]" title="" />
      <div className="text-left leading-none">
        <div className="font-display text-xl font-bold tracking-tight text-ink">Not Wasted</div>
        <div className="mt-1 text-xs font-medium text-brand-700">Surplus saved</div>
      </div>
    </div>
  );
}
