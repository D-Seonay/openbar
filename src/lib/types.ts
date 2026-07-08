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

export interface Bottle {
  id: string;
  name: string;
  type: BottleType;
  quantity: number;
  tags: string[];
  vip: boolean;
  notes?: string;
  lowStockThreshold?: number;
  createdAt: string;
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

export interface Store {
  bottles: Bottle[];
  events: EventItem[];
  contributions: Contribution[];
}
