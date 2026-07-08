import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";

// Matches /soirees/<slug> exactly, but not /soirees/<slug>/bilan — the guest
// page stays public, the bilan screen stays admin-only.
const PUBLIC_GUEST_PAGE = /^\/soirees\/[^/]+$/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || PUBLIC_GUEST_PAGE.test(pathname)) {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_PASSWORD ?? "";
  const expectedHash = expected ? await hashPassword(expected) : null;
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (!expectedHash || sessionCookie !== expectedHash) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
