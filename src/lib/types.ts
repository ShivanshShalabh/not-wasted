export type Category = "food" | "furniture" | "clothing" | "other";
export type View = "donor" | "recipient" | "impact" | "agent";
export type BatchStatus = "AVAILABLE" | "FULLY_CLAIMED";
export type ClaimStatus = "CLAIMED" | "PICKED_UP" | "CANCELLED";
export const STORAGE_TYPES = ["Refrigerated", "Frozen", "Warm/Insulated", "Shelf-Stable"] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];
export type Transport = "Donor delivers" | "Recipient picks up" | "Hub";
export type Condition = "New" | "Like New" | "Good" | "Fair";
export type NotifyChannel = "Email" | "SMS";
export type EventType = "Career Fair" | "Conference" | "Medical Rounds" | "Corporate Breakfast" | "Gala" | "Other";

/** Category-specific details. Every field is optional so AI eval and manual entry can fill any subset. */
export interface ItemAttributes {
  // food
  items?: string[];
  allergens?: string[];
  dietary?: string[];
  storage?: StorageType;
  shelfLifeHours?: number;
  // furniture
  itemTypes?: string[];
  condition?: Condition;
  needsTruck?: boolean;
  twoPersonLift?: boolean;
  dimensions?: string;
  // clothing
  garmentTypes?: string[];
  sizeRange?: string;
  season?: string;
  // shared
  notes?: string;
}

export type QualityVerdict = "Good to donate" | "Check before pickup" | "Not suitable";

/** AI intake inspection of the photo: is it fit to donate, and why. */
export interface QualityCheck {
  verdict: QualityVerdict;
  notes: string;
}

export interface DonorEvent {
  id: string;
  name: string;
  institution: string;
  department: string;
  address: string;
  eventType: EventType;
  start: number;
  end: number;
  rsvps: number;
  foodOrdered: number;
  mealDescription: string;
  storage: StorageType;
  transport: Transport;
  contact: string;
  predictedSurplus: number;
  pingSent: boolean;
  batchId?: string;
}

export interface Batch {
  id: string;
  category: Category;
  title: string;
  institution: string;
  department: string;
  address: string;
  eventId?: string;
  totalQty: number;
  remainingQty: number;
  status: BatchStatus;
  attributes: ItemAttributes;
  transport: Transport;
  postedAt: number;
  pickupBy: number;
  aiSource: "oci" | "local";
  quality?: QualityCheck;
  /** Small JPEG data URL of the donor's photo, so recipients can see the food. */
  photo?: string;
}

export interface Claim {
  id: string;
  batchId: string;
  recipientId: string;
  qty: number;
  claimedAt: number;
  etaMinutes: number;
  pickupBy: number;
  status: ClaimStatus;
  pickedUpAt?: number;
}

/** A recipient queued for a batch; first in line is auto-claimed when quantity frees up. */
export interface WaitlistEntry {
  id: string;
  batchId: string;
  recipientId: string;
  qty: number;
  joinedAt: number;
}

export interface RecipientOrg {
  id: string;
  name: string;
  type: string;
  address: string;
  distanceMi: number;
  /** Map position for the SVG network schematic, 0..100. */
  x: number;
  y: number;
  acceptedCategories: Category[];
  /** Remaining storage capacity per accepted category, in that category's unit. */
  capacity: Partial<Record<Category, number>>;
  notifyChannel: NotifyChannel;
  contact: string;
  verified: boolean;
  /** What the org serves / needs most — keywords drive donor ↔ recipient matching. */
  needs: string[];
  hasTruck: boolean;
  coldStorage: boolean;
  /** Free-text requirements (dietary restrictions, what they can't take). Drives dietary checks + semantic matching. */
  requirements?: string;
  /** Neighborhood food-access need from public data (Census tract → USDA Food Access Research Atlas). */
  area?: AreaNeed;
}

export interface AreaNeed {
  tract: string;
  /** 0..1, higher = more under-served. */
  need: number;
  lowIncomeLowAccess: boolean;
  povertyRate: number;
  lat?: number;
  lng?: number;
}

export type Role = "donor" | "recipient";

export interface Account {
  id: string;
  role: Role;
  email: string;
  /** SHA-256 of "not-wasted:" + password. Client-side demo auth only — not production security. */
  passwordHash: string;
  orgName: string;
  orgType: string;
  address: string;
  lat?: number;
  lng?: number;
  contactName: string;
  phone: string;
  /** Recipient accounts own one RecipientOrg in the network. */
  recipientId?: string;
}

export interface DemoState {
  version: number;
  view: View;
  activeRecipientId: string;
  events: DonorEvent[];
  batches: Batch[];
  claims: Claim[];
  waitlist: WaitlistEntry[];
  recipients: RecipientOrg[];
  pingEventId: string | null;
  accounts: Account[];
  sessionId: string | null;
  lastError: string | null;
  lastNotice: string | null;
}
