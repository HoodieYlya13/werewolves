import { NextResponse, type NextRequest } from "next/server";
import { discover } from "@/lib/account";
import { authConfig, callbackUrl, codeChallenge, cookieOptions, COOKIES, randomString, safeReturnTo, SCOPE, sitePath } from "@/lib/auth";

/** Starts signing in: Authorization Code with PKCE, then back to `returnTo`. */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const config = authConfig();
  if (!config) return NextResponse.redirect(sitePath(request, returnTo));

  const verifier = randomString();
  const state = randomString(16);
  const nonce = randomString(16);
  const { authorization_endpoint } = await discover(config.issuer);
  const url = new URL(authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: callbackUrl(request),
    scope: SCOPE,
    state,
    nonce,
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: "S256",
  }).toString();

  const response = NextResponse.redirect(url);
  response.cookies.set(COOKIES.flow, JSON.stringify({ verifier, state, nonce, returnTo }), cookieOptions(request, 10 * 60));
  return response;
}
