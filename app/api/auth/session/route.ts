import { after, connection, NextResponse, type NextRequest } from "next/server";
import { authConfig, currentAccount } from "@/lib/auth";
import { saveAccount } from "@/lib/friends";
import type { Session } from "@/lib/session";

/**
 * Who is signed in: the account's name and photo, never its tokens. Pages ask
 * /api/auth/ticket when they need to prove the account to a room.
 */
export async function GET(request: NextRequest) {
  // Per request, never prerendered: the answer depends on cookies and env.
  await connection();
  const config = authConfig();
  if (!config) return json({ enabled: false, account: null, sessionId: null, noPasskey: false });
  // ?fresh=1: refreshed now, for the latest name and photo (see markAccountVisit).
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  const { account, sessionId, noPasskey, finish } = await currentAccount(request, config, { fresh });
  const response = json({ enabled: true, account, sessionId, noPasskey });
  // Friends see the account's name and photo: saved at most daily per device,
  // and after a visit to the account page (`fresh`), once the answer is sent.
  const url = process.env.POSTGRES_URL;
  if (account && url && (fresh || !request.cookies.has(PROFILE_SAVED))) {
    after(() => saveAccount(url, account).catch((error) => console.error("Saving the account failed:", error)));
    response.cookies.set(PROFILE_SAVED, "1", { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 24 * 60 * 60 });
  }
  return finish(response);
}

/** Set once the account's profile was saved for friends today (see GET). */
const PROFILE_SAVED = "ww_profile";

function json(session: Omit<Session, "issuer" | "clientId" | "stats">) {
  const config = authConfig();
  const value: Session = {
    ...session,
    issuer: config?.issuer ?? null,
    clientId: config?.clientId ?? null,
    stats: session.enabled && !!process.env.POSTGRES_URL,
  };
  return NextResponse.json(value, { headers: { "Cache-Control": "no-store" } });
}
