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
  id: string;
  slug: string;
  name: string;
  date: string;
  createdAt: string;
}

export interface ContributionUser {
  id: string;
  username: string;
}

export interface Contribution {
  id: string;
  eventId: string;
  user: ContributionUser;
  item: string;
  quantity?: string;
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  eventId: string;
  bottleId: string;
  bottleName: string;
  quantityBefore: number;
  quantityAfter: number;
  createdAt: string;
}

export interface AccountUser {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
  vip: boolean;
  createdAt: string;
}
