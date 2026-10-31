import { NextResponse, type NextRequest } from "next/server";
import { authConfig, clearTokens, safeReturnTo, signOutAllowed, sitePath } from "@/lib/auth";

/**
 * Where the auth server sends the browser after signing out; `state` holds the
 * page to go back to. Signing out there (from its account page too) signs out
 * here as well: already done when the sign-out started here, not otherwise.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(sitePath(request, safeReturnTo(request.nextUrl.searchParams.get("state"))));
  if (signOutAllowed(request, authConfig())) clearTokens(request, response);
  return response;
}
