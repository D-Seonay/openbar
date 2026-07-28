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
  isArchived: boolean;
}

export interface Bar {
  id: string;
  name: string;
  createdAt: string;
  myRole: "OWNER" | "MEMBER";
  myVip: boolean;
  isPublic: boolean;
  inviteToken: string | null;
}

export interface BarMember {
  id: string;
  barId: string;
  userId: string;
  role: "OWNER" | "MEMBER";
  vip: boolean;
  createdAt: string;
  user: {
    username: string;
    birthday: string | null;
    favoriteDrink: string | null;
    allergies: string | null;
    avatarUrl: string | null;
  };
}

export interface MyProfile {
  id: string;
  username: string;
  birthday: string | null;
  favoriteDrink: string | null;
  allergies: string | null;
  avatarUrl: string | null;
}

export interface BarDirectoryEntry {
  id: string;
  name: string;
  ownerUsername: string;
  memberCount: number;
  myStatus: "OWNER" | "MEMBER" | "PENDING" | "NONE";
}

export interface PendingJoinRequest {
  id: string;
  barId: string;
  userId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  user: { username: string };
}

export interface UserSearchResult {
  id: string;
  username: string;
}

export interface InviteLinkPreview {
  barName: string;
}

export interface BarAdminSummary {
  id: string;
  name: string;
  ownerUsername: string;
  memberCount: number;
  isPublic: boolean;
  createdAt: string;
}

export interface BarAdminDetail {
  id: string;
  name: string;
  isPublic: boolean;
  inviteToken: string | null;
  memberCount: number;
  ownerUsername: string;
}
