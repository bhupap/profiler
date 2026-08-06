import { NextRequest, NextResponse } from "next/server";

const BYPASS_COOKIE = "maint_bypass";

export function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== "true") return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Always allow the maintenance page and its unlock API
  if (
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/api/maintenance")
  ) {
    return NextResponse.next();
  }

  // Allow static assets (_next internals, favicon, etc.)
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  // If the visitor already has a valid bypass cookie, let them through
  const bypass = request.cookies.get(BYPASS_COOKIE)?.value;
  if (bypass && bypass === process.env.MAINTENANCE_CODE) {
    return NextResponse.next();
  }

  // Redirect everything else to the maintenance page
  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
