/**
 * Local semantic similarity — the offline twin of OCI GenAI embeddings (cohere.embed)
 * + Oracle 26ai VECTOR_DISTANCE. Words are expanded into shared concepts so
 * "boxed lunches" and "sandwich wraps" land near each other without exact keyword overlap.
 */

const CONCEPTS: Record<string, string[]> = {
  meal: ["meal", "lunch", "dinner", "breakfast", "entree", "plate", "boxed", "catering", "sandwich", "wrap", "pasta", "rice", "soup", "curry", "pizza", "burrito", "taco"],
  hot: ["hot", "warm", "soup", "pasta", "rice", "curry", "stew", "casserole", "roasted", "insulated"],
  produce: ["produce", "fruit", "vegetable", "veggie", "salad", "apple", "banana", "orange", "berries", "greens", "lettuce"],
  bakery: ["pastry", "bread", "roll", "muffin", "croissant", "bagel", "cookie", "cake", "donut", "baked"],
  breakfast: ["breakfast", "pastry", "muffin", "bagel", "croissant", "yogurt", "cereal", "coffee", "oatmeal", "egg"],
  shelf: ["dry", "canned", "shelf", "stable", "packaged", "sealed", "snack", "chips", "granola", "bars"],
  family: ["family", "families", "kids", "children", "child", "youth", "students"],
  seating: ["chair", "chairs", "stool", "bench", "sofa", "couch", "seating"],
  surface: ["desk", "desks", "table", "tables", "workstation"],
  bedroom: ["bed", "beds", "mattress", "dresser", "nightstand", "linens", "sheets", "bedding"],
  storage: ["cabinet", "bookcase", "shelf", "shelving", "dresser", "filing"],
  outerwear: ["coat", "coats", "jacket", "jackets", "winter", "fleece", "hoodie", "scarf", "gloves", "parka"],
  professional: ["professional", "uniform", "uniforms", "suit", "blazer", "polo", "interview", "work", "chef"],
  linens: ["towel", "towels", "linen", "linens", "sheets", "blanket", "blankets", "bedding"],
  footwear: ["shoe", "shoes", "boots", "sneakers"],
  electronics: ["monitor", "monitors", "laptop", "keyboard", "computer", "printer", "electronics"],
  school: ["backpack", "backpacks", "supplies", "notebook", "books", "school"],
};

const WORD_TO_CONCEPTS = new Map<string, string[]>();
for (const [concept, ws] of Object.entries(CONCEPTS))
  for (const w of ws) WORD_TO_CONCEPTS.set(w, [...(WORD_TO_CONCEPTS.get(w) ?? []), concept]);

const STOP = new Set(["the", "and", "for", "with", "our", "are", "can", "not", "but", "from", "this", "that", "have", "all", "any", "take", "need", "needs", "please", "must", "most", "also", "only", "very", "per", "day", "who", "they", "them", "their", "many", "much", "some"]);

const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");

function vector(text: string): Map<string, number> {
  const v = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    const s = stem(raw);
    v.set(`w:${s}`, (v.get(`w:${s}`) ?? 0) + 1);
    for (const c of WORD_TO_CONCEPTS.get(raw) ?? WORD_TO_CONCEPTS.get(s) ?? []) v.set(`c:${c}`, (v.get(`c:${c}`) ?? 0) + 1.5);
  }
  return v;
}

export function cosine(a: number[] | Map<string, number>, b: number[] | Map<string, number>): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }
  const ma = a as Map<string, number>, mb = b as Map<string, number>;
  let dot = 0, na = 0, nb = 0;
  for (const [k, x] of ma) { na += x * x; dot += x * (mb.get(k) ?? 0); }
  for (const x of mb.values()) nb += x * x;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** 0..1 similarity between a donation description and a recipient's needs/requirements. */
export function semanticSimilarity(a: string, b: string): number {
  return cosine(vector(a), vector(b));
}
