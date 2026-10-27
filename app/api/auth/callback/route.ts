import { NextResponse, type NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/account";
import { authConfig, callbackUrl, cookieOptions, COOKIES, requestTokens, safeReturnTo, saveSession, saveTokens, sitePath } from "@/lib/auth";
import { newSessionId } from "@/lib/protocol";

type Flow = { verifier: string; state: string; nonce: string; returnTo: string };

/** The auth server sends the browser back here with a code to exchange for tokens. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let flow: Flow | null = null;
  try {
    flow = JSON.parse(request.cookies.get(COOKIES.flow)?.value ?? "null");
  } catch {}
  // Back to the page sign-in started from, signed in or not.
  const back = () => {
    const response = NextResponse.redirect(sitePath(request, safeReturnTo(flow?.returnTo)));
    response.cookies.set(COOKIES.flow, "", cookieOptions(request, 0));
    return response;
  };

  const config = authConfig();
  const code = params.get("code");
  // Cancelled on the auth server, or a stale or forged callback.
  if (!config || !flow || !code || params.get("state") !== flow.state) return back();

  const tokens = await requestTokens(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl(request),
    code_verifier: flow.verifier,
  });
  const account = await verifyIdToken(tokens?.id_token, { ...config, nonce: flow.nonce });
  if (!tokens || !account) return back();

  const response = back();
  saveTokens(request, response, tokens, account.expiresAt);
  // A new sign-in: other devices on this account get signed out.
  saveSession(request, response, newSessionId());
  return response;
}
