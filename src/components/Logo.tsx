/** Path data for each part of the mark, shared with the landing story's logo animation. */
export const LOGO_VIEWBOX = "20 36 216 142";
export const LOGO_PARTS = {
  donorHand: "M27 94C27 84 39 79 46 87L77 120C90 133 103 141 121 143L147 146C157 147 162 158 155 165C150 170 143 172 135 172H123C84 172 51 148 34 118C29 109 27 101 27 94Z",
  recipientHand: "M229 94C229 84 217 79 210 87L179 120C166 133 153 141 135 143L109 146C99 147 94 158 101 165C106 170 113 172 121 172H133C172 172 205 148 222 118C227 109 229 101 229 94Z",
  seed: "M115.81 83.0361C121.498 78.988 134.502 78.988 140.19 83.0361C144.254 86.0723 145.067 91.1325 142.629 97.2048L132.876 117.446C130.438 123.518 125.562 123.518 123.124 117.446L113.371 97.2048C110.933 91.1325 111.746 86.0723 115.81 83.0361Z",
  leaf: "M127.5 81C117.5 81 112.5 75 112.5 66C122.5 64 129.5 70 129.5 78C128.5 69 134.5 63 143.5 63C145.5 73 138.5 80 127.5 81Z",
};
export const LOGO_GREEN = "#165840";
export const LOGO_ORANGE = "#F0703D";

/**
 * Not Wasted mark (assets/Logo - color.svg): two hands — donor (green) and recipient (orange) —
 * cradling a sprouting seed. On hover of a `group` parent, the hands lean in and the sprout lifts.
 */
export function Logo({ className = "h-10 w-auto", title = "Not Wasted" }: { className?: string; title?: string }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} role={title ? "img" : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true}>
      <g className="origin-[60px_120px] transition-transform duration-500 ease-out group-hover:translate-x-1 group-hover:-rotate-3">
        <path d={LOGO_PARTS.donorHand} fill={LOGO_GREEN} />
        <circle cx="58" cy="59" r="16" fill={LOGO_GREEN} />
      </g>
      <g className="origin-[196px_120px] transition-transform duration-500 ease-out group-hover:-translate-x-1 group-hover:rotate-3">
        <path d={LOGO_PARTS.recipientHand} fill={LOGO_ORANGE} />
        <circle cx="198" cy="59" r="16" fill={LOGO_ORANGE} />
      </g>
      <g className="transition-transform duration-500 ease-out group-hover:-translate-y-1.5">
        <path d={LOGO_PARTS.seed} fill={LOGO_ORANGE} />
        <path d={LOGO_PARTS.leaf} fill={LOGO_GREEN} />
      </g>
    </svg>
  );
}
