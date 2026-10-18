import { AlertTriangle, Clock, Flame, Leaf, Package, Ruler, Snowflake, Truck, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Category, Condition, ItemAttributes } from "@/lib/types";
import { Badge } from "./ui";

/**
 * Theme-tone pills for status chips. Sage = positive/success, brand = terracotta accent.
 * Text colors are darkened past the 700 tokens where needed to keep >= 4.5:1 on the tinted fill.
 */
export const PILL_TONE = {
  sage: "bg-sage-100/80 text-[#2f6b3d] ring-sage-500/40",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  solid: "bg-brand-600 text-white ring-brand-600",
} as const;

export function Pill({ children, tone = "sage", className = "" }: { children: ReactNode; tone?: keyof typeof PILL_TONE; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${PILL_TONE[tone]} ${className}`}>{children}</span>;
}

/** Storage pill: warm orange for hot food, cool blue for cold, neutral for shelf-stable. */
export function StorageBadge({ storage }: { storage: string }) {
  const [cls, Icon] = storage === "Warm/Insulated" ? ["bg-orange-50 text-orange-800 ring-orange-200", Flame]
    : storage === "Shelf-Stable" ? ["bg-stone-100 text-stone-700 ring-stone-200", Package]
    : ["bg-sky-50 text-sky-800 ring-sky-200", Snowflake];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}><Icon className="h-3 w-3" /> {storage}</span>;
}

export function AttributeTags({ category, a }: { category: Category; a: ItemAttributes }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {category === "food" && (
        <>
          {a.storage && <StorageBadge storage={a.storage} />}
          {a.shelfLifeHours != null && <Badge tone="amber"><Clock className="h-3 w-3" /> Pick up within {a.shelfLifeHours}h</Badge>}
          {a.dietary?.map((d) => <Pill key={d}><Leaf className="h-3 w-3" /> {d}</Pill>)}
          {a.allergens?.map((d) => <Badge key={d} tone="red"><AlertTriangle className="h-3 w-3" /> Contains {d}</Badge>)}
        </>
      )}
      {category === "furniture" && (
        <>
          {a.condition && <Pill>Condition: {a.condition}</Pill>}
          {a.needsTruck && <Badge tone="amber"><Truck className="h-3 w-3" /> Truck required</Badge>}
          {a.twoPersonLift && <Badge tone="amber"><Users className="h-3 w-3" /> 2-person lift</Badge>}
          {a.dimensions && <Badge><Ruler className="h-3 w-3" /> {a.dimensions}</Badge>}
        </>
      )}
      {category === "clothing" && (
        <>
          {a.condition && <Pill>Condition: {a.condition}</Pill>}
          {a.sizeRange && <Badge>Sizes {a.sizeRange}</Badge>}
          {a.season && <Badge tone="blue">{a.season}</Badge>}
        </>
      )}
      {category === "other" && (
        <>
          {a.condition && <Pill>Condition: {a.condition}</Pill>}
          {a.notes && <Badge>{a.notes}</Badge>}
        </>
      )}
    </div>
  );
}

export const ALLERGEN_OPTIONS = ["Gluten", "Dairy", "Eggs", "Peanuts", "Tree nuts", "Soy", "Fish", "Shellfish", "Sesame"];
export const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free", "Dairy-free"];
export const CONDITION_OPTIONS: Condition[] = ["New", "Like New", "Good", "Fair"];

/** Case-insensitive union of two tag lists, keeping the first list's spelling. */
export const mergeTags = (a: string[] | undefined, b: string[]) => [...(a ?? []), ...b.filter((x) => !(a ?? []).some((y) => y.toLowerCase() === x.toLowerCase()))];
/** Keep only tags that match `options` (case-insensitive), in their canonical spelling. Drops AI noise like "Non-Vegan". */
export const knownTags = (list: string[] | undefined, options: string[]) =>
  options.filter((o) => list?.some((v) => v.toLowerCase() === o.toLowerCase()));
/** Add or remove one tag (case-insensitive). */
export const toggleTag = (list: string[] | undefined, v: string) =>
  list?.some((x) => x.toLowerCase() === v.toLowerCase()) ? list.filter((x) => x.toLowerCase() !== v.toLowerCase()) : [...(list ?? []), v];

/** Toggleable tag pills (allergens, dietary). Values outside `options` (e.g. AI-detected) are shown too. */
export function TagChips({ label, options, selected, tone, onToggle }: { label: string; options: string[]; selected?: string[]; tone: "red" | "green"; onToggle: (v: string) => void }) {
  const all = [...options, ...(selected ?? []).filter((v) => !options.some((o) => o.toLowerCase() === v.toLowerCase()))];
  const on = tone === "red" ? "bg-red-50 text-red-700 ring-red-300" : "bg-sage-100/80 text-[#2f6b3d] ring-sage-500/60";
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-stone-700">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {all.map((o) => {
          const active = selected?.some((v) => v.toLowerCase() === o.toLowerCase());
          return (
            <button key={o} type="button" aria-pressed={active} onClick={() => onToggle(selected?.find((v) => v.toLowerCase() === o.toLowerCase()) ?? o)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition duration-200 hover:-translate-y-px active:scale-95 ${active ? on : "bg-white text-stone-600 ring-stone-200 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"}`}>{o}</button>
          );
        })}
      </div>
    </div>
  );
}


/** Which attribute holds the item list for a category. */
export function itemKey(category: Category) {
  return category === "food" ? "items" : category === "furniture" ? "itemTypes" : category === "clothing" ? "garmentTypes" : undefined;
}

export function itemList(category: Category, a: ItemAttributes) {
  const k = itemKey(category);
  return (k ? a[k] : undefined) ?? [];
}
