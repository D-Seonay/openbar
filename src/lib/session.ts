import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export const SESSION_COOKIE = "bardenoa_session";

export interface SessionUser {
  sub: string;
  username: string;
  role: "ADMIN" | "USER";
  vip: boolean;
}

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me");
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function isAdminLoggedIn(): Promise<boolean> {
  const session = await getSession();
  return session?.role === "ADMIN";
}
