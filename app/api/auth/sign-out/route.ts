import { NextResponse, type NextRequest } from "next/server";
import { authConfig, clearTokens, COOKIES, endSignInOnAuthServer } from "@/lib/auth";

/**
 * Signs out without leaving the page: the sign-in ends on the auth server from
 * here, then this device forgets it. `endedOnAuthServer` false: the page
 * signs out through the auth server instead (/api/auth/logout).
 */
export async function POST(request: NextRequest) {
  // Only this site's pages: another site can't sign anyone out (logout CSRF).
  if (request.headers.get("sec-fetch-site") !== "same-origin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const config = authConfig();
  const refreshToken = request.cookies.get(COOKIES.refresh)?.value;
  const endedOnAuthServer = !!config && !!refreshToken && (await endSignInOnAuthServer(config, refreshToken));

  const response = NextResponse.json({ endedOnAuthServer }, { headers: { "Cache-Control": "no-store" } });
  clearTokens(request, response);
  return response;
}
