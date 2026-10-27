import { connection, NextResponse, type NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/account";
import { authConfig, clearTokens, COOKIES, requestTokens, saveSession, saveTokens } from "@/lib/auth";
import { newSessionId } from "@/lib/protocol";
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
  if (!config) return json({ enabled: false, account: null, idToken: null, sessionId: null });
  // Signed in before sessions existed: start one now.
  const savedSession = request.cookies.get(COOKIES.session)?.value;
  const sessionId = savedSession ?? newSessionId();
  const withSession = (response: NextResponse) => {
    if (!savedSession) saveSession(request, response, sessionId);
    return response;
  };

  const idToken = request.cookies.get(COOKIES.id)?.value;
  const current = await verifyIdToken(idToken, config);
  if (current && current.expiresAt - Date.now() > MIN_VALIDITY_MS) {
    return withSession(json({ enabled: true, account: publicAccount(current), idToken: idToken!, sessionId }));
  }

  const refreshToken = request.cookies.get(COOKIES.refresh)?.value;
  const tokens = refreshToken ? await requestTokens(config, { grant_type: "refresh_token", refresh_token: refreshToken }) : null;
  const account = await verifyIdToken(tokens?.id_token, config);
  if (!tokens || !account) {
    const response = json({ enabled: true, account: null, idToken: null, sessionId: null });
    if (refreshToken || idToken) clearTokens(request, response);
    return response;
  }
  const response = withSession(json({ enabled: true, account: publicAccount(account), idToken: tokens.id_token!, sessionId }));
  saveTokens(request, response, tokens, account.expiresAt);
  return response;
}

const publicAccount = ({ sub, name, picture }: { sub: string; name: string; picture: string | null }) => ({ sub, name, picture });

function json(session: Session) {
  return NextResponse.json(session, { headers: { "Cache-Control": "no-store" } });
}
