import { AlertTriangle, Clock, Leaf, Ruler, Snowflake, Truck, Users } from "lucide-react";
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

export function AttributeTags({ category, a }: { category: Category; a: ItemAttributes }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {category === "food" && (
        <>
          {a.storage && <Badge tone="blue"><Snowflake className="h-3 w-3" /> {a.storage}</Badge>}
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

/** Which attribute holds the item list for a category. */
export function itemKey(category: Category) {
  return category === "food" ? "items" : category === "furniture" ? "itemTypes" : category === "clothing" ? "garmentTypes" : undefined;
}

export function itemList(category: Category, a: ItemAttributes) {
  const k = itemKey(category);
  return (k ? a[k] : undefined) ?? [];
}
