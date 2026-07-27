import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const CHANGE_PASSWORD_PATH = "/changer-mot-de-passe";
const ALLOWED_WHILE_MUST_CHANGE_PASSWORD = new Set([CHANGE_PASSWORD_PATH, "/login", "/logout"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname.endsWith("/bilan") && session?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session?.mustChangePassword && !ALLOWED_WHILE_MUST_CHANGE_PASSWORD.has(pathname)) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
