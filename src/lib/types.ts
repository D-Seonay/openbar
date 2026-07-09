export type BottleType =
  | "whisky"
  | "rhum"
  | "vodka"
  | "gin"
  | "tequila"
  | "liqueur"
  | "vin"
  | "champagne"
  | "biere"
  | "mixer"
  | "autre";

export interface BottleVolume {
  size: string; // e.g. "70cl", "1L", "1.5L"
  quantity: number; // count of bottles of this size
}

export interface Bottle {
  id: string;
  name: string;
  type: BottleType;
  quantity: number; // Total sum of quantities
  tags: string[];
  vip: boolean;
  notes?: string;
  lowStockThreshold?: number;
  createdAt: string;
  volumes?: BottleVolume[];
  imageUrl?: string;
}

export interface EventItem {
  slug: string;
  name: string;
  date: string;
  vipNames: string[];
  createdAt: string;
}

export interface Contribution {
  id: string;
  eventSlug: string;
  guestName: string;
  item: string;
  quantity?: string;
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  eventSlug: string;
  bottleId: string;
  bottleName: string;
  quantityBefore: number;
  quantityAfter: number;
  createdAt: string;
}

export interface Store {
  bottles: Bottle[];
  events: EventItem[];
  contributions: Contribution[];
  stockAdjustments: StockAdjustment[];
}
