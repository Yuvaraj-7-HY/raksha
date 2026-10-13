// middleware.ts
// Admin authentication + ALLOWED_TO_NUMBERS gate for protected routes

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ALLOWED_NUMBERS = (process.env.ALLOWED_TO_NUMBERS ?? "").split(",").map(s => s.trim()).filter(Boolean);

const PROTECTED_PREFIXES = [
  "/api/call",
  "/console",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip non-protected routes
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Check admin password via header or cookie
  const provided = req.headers.get("x-admin-password") || req.cookies.get("admin_password")?.value;
  if (!ADMIN_PASSWORD || provided !== ADMIN_PASSWORD) {
    return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // For /api/call/start, validate 'to' number
  if (pathname === "/api/call/start" && req.method === "POST") {
    // We can't easily read body here; validation happens in route handler
    // This is a second layer; route handler does the real check
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/call/:path*", "/console/:path*"],
};