import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./session";
import type {
  Bottle,
  EventItem,
  Contribution,
  StockAdjustment,
  AccountUser,
  Bar,
  BarMember,
  BarDirectoryEntry,
  PendingJoinRequest,
  UserSearchResult,
  InviteLinkPreview,
} from "./types";
import type { CocktailRecipe, RecipeAvailability } from "./cocktail-types";

const API_URL = process.env.NEST_API_URL ?? "http://localhost:3001";

export async function apiLogin(
  username: string,
  password: string,
): Promise<{ token: string } | null> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const setCookie = res.headers.get("set-cookie");
  const match = setCookie?.match(/bardenoa_session=([^;]+)/);
  if (!match) return null;

  return { token: match[1] };
}

export async function apiSignup(
  username: string,
  password: string,
): Promise<{ token: string } | null> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const setCookie = res.headers.get("set-cookie");
  const match = setCookie?.match(/bardenoa_session=([^;]+)/);
  if (!match) return null;

  return { token: match[1] };
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? `Erreur API (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export { ApiError };

// Bottles
export function listBottles(barId: string): Promise<Bottle[]> {
  return request<Bottle[]>(`/bottles?barId=${barId}`);
}

export function addBottle(
  barId: string,
  input: Omit<Bottle, "id" | "createdAt">,
): Promise<Bottle> {
  return request<Bottle>("/bottles", { method: "POST", body: JSON.stringify({ ...input, barId }) });
}

export function updateBottle(
  id: string,
  input: Partial<Omit<Bottle, "id" | "createdAt">>,
): Promise<Bottle> {
  return request<Bottle>(`/bottles/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteBottle(id: string): Promise<{ success: boolean }> {
  return request(`/bottles/${id}`, { method: "DELETE" });
}

// Events
export function listEvents(barId: string): Promise<EventItem[]> {
  return request<EventItem[]>(`/events?barId=${barId}`);
}

export async function getEvent(slug: string): Promise<EventItem | null> {
  try {
    return await request<EventItem>(`/events/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function createEvent(barId: string, input: { name: string; date: string }): Promise<EventItem> {
  return request<EventItem>("/events", { method: "POST", body: JSON.stringify({ ...input, barId }) });
}

export function deleteEvent(slug: string): Promise<{ success: boolean }> {
  return request(`/events/${slug}`, { method: "DELETE" });
}

// Contributions
export function listContributions(slug: string): Promise<Contribution[]> {
  return request<Contribution[]>(`/events/${slug}/contributions`);
}

export function addContribution(
  slug: string,
  input: { item: string; quantity?: string },
): Promise<Contribution> {
  return request<Contribution>(`/events/${slug}/contributions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteContribution(slug: string, id: string): Promise<{ success: boolean }> {
  return request(`/events/${slug}/contributions/${id}`, { method: "DELETE" });
}

// Stock Adjustments
export function listStockAdjustments(slug: string): Promise<StockAdjustment[]> {
  return request<StockAdjustment[]>(`/events/${slug}/stock-adjustments`);
}

export function applyStockAdjustments(
  slug: string,
  changes: { bottleId: string; quantityAfter: number }[],
): Promise<StockAdjustment[]> {
  return request<StockAdjustment[]>(`/events/${slug}/stock-adjustments`, {
    method: "POST",
    body: JSON.stringify({ changes }),
  });
}

// Cocktails
export function evaluateCocktails(barId: string): Promise<RecipeAvailability[]> {
  return request<RecipeAvailability[]>(`/cocktails?barId=${barId}`);
}

export interface RecipeInput {
  name: string;
  glass: string;
  tags: string[];
  ingredientsList: string[];
  instructions: string[];
  prepTime: string;
  difficulty: "Facile" | "Moyen" | "Expert";
  description: string;
  vip: boolean;
}

export function createRecipe(barId: string, input: RecipeInput): Promise<CocktailRecipe> {
  return request<CocktailRecipe>("/recipes", { method: "POST", body: JSON.stringify({ ...input, barId }) });
}

export function updateRecipe(id: string, input: Partial<RecipeInput>): Promise<CocktailRecipe> {
  return request<CocktailRecipe>(`/recipes/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteRecipe(id: string): Promise<{ success: boolean }> {
  return request(`/recipes/${id}`, { method: "DELETE" });
}

// Users
export function listUsers(): Promise<AccountUser[]> {
  return request<AccountUser[]>("/users");
}

export function createUser(input: {
  username: string;
  password: string;
  role?: "ADMIN" | "USER";
  vip?: boolean;
}): Promise<AccountUser> {
  return request<AccountUser>("/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateUser(
  id: string,
  input: { role?: "ADMIN" | "USER"; vip?: boolean; password?: string },
): Promise<AccountUser> {
  return request<AccountUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteUser(id: string): Promise<{ success: boolean }> {
  return request(`/users/${id}`, { method: "DELETE" });
}

// Bars
export function listMyBars(): Promise<Bar[]> {
  return request<Bar[]>("/bars/mine");
}

export function createBar(name: string): Promise<{ id: string; name: string }> {
  return request("/bars", { method: "POST", body: JSON.stringify({ name }) });
}

export function listBarMembers(barId: string): Promise<BarMember[]> {
  return request<BarMember[]>(`/bars/${barId}/members`);
}

export function inviteBarMember(barId: string, username: string, vip: boolean): Promise<BarMember> {
  return request<BarMember>(`/bars/${barId}/members`, {
    method: "POST",
    body: JSON.stringify({ username, vip }),
  });
}

export function updateBarMemberVip(barId: string, membershipId: string, vip: boolean): Promise<BarMember> {
  return request<BarMember>(`/bars/${barId}/members/${membershipId}`, {
    method: "PATCH",
    body: JSON.stringify({ vip }),
  });
}

export function removeBarMember(barId: string, membershipId: string): Promise<{ success: boolean }> {
  return request(`/bars/${barId}/members/${membershipId}`, { method: "DELETE" });
}

export function listBarsDirectory(): Promise<BarDirectoryEntry[]> {
  return request<BarDirectoryEntry[]>("/bars/directory");
}

export function requestToJoinBar(barId: string): Promise<{ id: string; status: string }> {
  return request(`/bars/${barId}/join-requests`, { method: "POST" });
}

export function listPendingJoinRequests(barId: string): Promise<PendingJoinRequest[]> {
  return request<PendingJoinRequest[]>(`/bars/${barId}/join-requests`);
}

export function respondToJoinRequest(
  barId: string,
  requestId: string,
  accept: boolean,
): Promise<{ id: string; status: string }> {
  return request(`/bars/${barId}/join-requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({ accept }),
  });
}

export function searchUsers(query: string): Promise<UserSearchResult[]> {
  return request<UserSearchResult[]>(`/bars/search-users?q=${encodeURIComponent(query)}`);
}

export function generateInviteLink(barId: string): Promise<{ inviteToken: string }> {
  return request(`/bars/${barId}/invite-link`, { method: "POST" });
}

export function previewInviteLink(token: string): Promise<InviteLinkPreview> {
  return request<InviteLinkPreview>(`/bars/invite/${token}/preview`);
}

export function joinViaInviteLink(token: string): Promise<{ barId: string; barName: string; alreadyMember: boolean }> {
  return request(`/bars/invite/${token}/join`, { method: "POST" });
}

export async function joinViaInviteLinkWithToken(
  token: string,
  sessionToken: string,
): Promise<{ barId: string; barName: string; alreadyMember: boolean }> {
  const res = await fetch(`${API_URL}/bars/invite/${token}/join`, {
    method: "POST",
    headers: { Cookie: `${SESSION_COOKIE}=${sessionToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? `Erreur API (${res.status})`);
  }
  return res.json();
}

export function updateBarVisibility(barId: string, isPublic: boolean): Promise<{ id: string; isPublic: boolean }> {
  return request(`/bars/${barId}/visibility`, { method: "PATCH", body: JSON.stringify({ isPublic }) });
}

export function renameBar(barId: string, name: string): Promise<{ id: string; name: string }> {
  return request(`/bars/${barId}/name`, { method: "PATCH", body: JSON.stringify({ name }) });
}
