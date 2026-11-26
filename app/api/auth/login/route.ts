import { type NextRequest } from "next/server";
import { discover } from "@/lib/account";
import { pathLocale, preferredLocale } from "@/lib/i18n/config";
import { authConfig, authServerDown, callbackUrl, codeChallenge, cookieOptions, COOKIES, randomString, redirectTo, safeReturnTo, SCOPE, sitePath } from "@/lib/auth";

/** Starts signing in: Authorization Code with PKCE, then back to `returnTo`. */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const config = authConfig();
  if (!config) return redirectTo(request, sitePath(request, returnTo));

  const discovery = await discover(config.issuer).catch(() => null);
  if (!discovery) return authServerDown(request, returnTo);

  const verifier = randomString();
  const state = randomString(16);
  const nonce = randomString(16);
  const url = new URL(discovery.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: callbackUrl(request),
    scope: SCOPE,
    state,
    nonce,
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: "S256",
    ui_locales: pathLocale(returnTo) ?? preferredLocale(request),
  }).toString();

  const response = redirectTo(request, url);
  response.cookies.set(COOKIES.flow, JSON.stringify({ verifier, state, nonce, returnTo }), cookieOptions(request, 10 * 60));
  return response;
}
