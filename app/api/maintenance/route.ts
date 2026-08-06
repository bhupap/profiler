import { NextRequest, NextResponse } from "next/server";

const BYPASS_COOKIE = "maint_bypass";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: NextRequest) {
  const { code } = await request.json();

  if (
    !code ||
    !process.env.MAINTENANCE_CODE ||
    code !== process.env.MAINTENANCE_CODE
  ) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(BYPASS_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
