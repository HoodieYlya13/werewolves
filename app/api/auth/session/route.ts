import { connection, NextResponse, type NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/account";
import { authConfig, clearTokens, COOKIES, requestTokens, saveTokens } from "@/lib/auth";
import type { Session } from "@/lib/session";

/** A token about to expire is refreshed rather than handed to a room. */
const MIN_VALIDITY_MS = 2 * 60 * 1000;

/**
 * Who is signed in, with a fresh ID token for the room server. Refreshes it
 * with the refresh token when needed (the auth server rotates that one).
 */
export async function GET(request: NextRequest) {
  // Per request, never prerendered: the answer depends on cookies and env.
  await connection();
  const config = authConfig();
  if (!config) return json({ enabled: false, account: null, idToken: null });

  const idToken = request.cookies.get(COOKIES.id)?.value;
  const current = await verifyIdToken(idToken, config);
  if (current && current.expiresAt - Date.now() > MIN_VALIDITY_MS) {
    return json({ enabled: true, account: { name: current.name, picture: current.picture }, idToken: idToken! });
  }

  const refreshToken = request.cookies.get(COOKIES.refresh)?.value;
  const tokens = refreshToken ? await requestTokens(config, { grant_type: "refresh_token", refresh_token: refreshToken }) : null;
  const account = await verifyIdToken(tokens?.id_token, config);
  if (!tokens || !account) {
    const response = json({ enabled: true, account: null, idToken: null });
    if (refreshToken || idToken) clearTokens(request, response);
    return response;
  }
  const response = json({ enabled: true, account: { name: account.name, picture: account.picture }, idToken: tokens.id_token! });
  saveTokens(request, response, tokens, account.expiresAt);
  return response;
}

function json(session: Session) {
  return NextResponse.json(session, { headers: { "Cache-Control": "no-store" } });
}
