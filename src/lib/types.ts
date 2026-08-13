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
  /** `null` clears the alert; absent leaves it untouched on a PATCH. */
  lowStockThreshold?: number | null;
  createdAt: string;
  volumes?: BottleVolume[];
  imageUrl?: string;
  barcode?: string | null; // digits only, unique per bar
}

/** A product the barcode resolved to online, before it becomes a Bottle. */
export interface LookedUpProduct {
  name: string;
  type: BottleType;
  imageUrl: string | null;
  size: string | null;
}

/**
 * Outcome of scanning a barcode, in the order the UI acts on it: a bottle this
 * bar already stocks, a product to prefill a new bottle with, or nothing.
 */
export type BarcodeLookupResult =
  | { status: "existing"; barcode: string; bottle: Bottle }
  | { status: "product"; barcode: string; product: LookedUpProduct }
  | { status: "unknown"; barcode: string };

export interface EventItem {
  id: string;
  slug: string;
  name: string;
  date: string;
  isClosed: boolean;
  barId: string;
  createdAt: string;
  _count?: {
    stockAdjustments: number;
  };
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

export interface WishlistItemAssignment {
  id: string;
  user: { id: string; username: string; avatarUrl: string | null };
}

export interface WishlistItem {
  id: string;
  eventId: string;
  label: string;
  /** How many guests the host wants on this item. Always at least 1. */
  neededCount: number;
  createdAt: string;
  assignments: WishlistItemAssignment[];
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

export type EventMediaKind = "UPLOAD" | "DRIVE_LINK";

export interface EventMedia {
  id: string;
  eventId: string;
  kind: EventMediaKind;
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
  uploader?: { id: string; username: string } | null;
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
  /** Discord channel the "à ramener" board is published to, if bound. */
  discordChannelId?: string | null;
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
  discordUserId: string | null;
  discordUsername: string | null;
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

/** One entry in a bar's journal. Denormalised on purpose — see the Prisma model. */
export interface AuditEntry {
  id: string;
  barId: string | null;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  createdAt: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}
