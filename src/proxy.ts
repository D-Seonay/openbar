import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect sensitive admin-only pages like /soirees/<slug>/bilan
  if (pathname.endsWith("/bilan")) {
    const expected = process.env.ADMIN_PASSWORD ?? "";
    const expectedHash = expected ? await hashPassword(expected) : null;
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

    if (!expectedHash || sessionCookie !== expectedHash) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
