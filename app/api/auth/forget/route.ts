import { NextResponse, type NextRequest } from "next/server";
import { clearTokens } from "@/lib/auth";

/**
 * Signs out on this device only, when the account signed in on another one.
 * The auth server's own session stays, so signing in again is one click.
 */
export function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  clearTokens(request, response);
  return response;
}
