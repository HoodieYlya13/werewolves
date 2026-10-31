import { connection, NextResponse, type NextRequest } from "next/server";
import { authConfig, currentAccount } from "@/lib/auth";
import type { Session } from "@/lib/session";

/**
 * Who is signed in: the account's name and photo, never its tokens. Pages ask
 * /api/auth/ticket when they need to prove the account to a room.
 */
export async function GET(request: NextRequest) {
  // Per request, never prerendered: the answer depends on cookies and env.
  await connection();
  const config = authConfig();
  if (!config) return json({ enabled: false, account: null, sessionId: null });
  // ?fresh=1: refreshed now, for the latest name and photo (see markAccountVisit).
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  const { account, sessionId, finish } = await currentAccount(request, config, { fresh });
  return finish(json({ enabled: true, account, sessionId }));
}

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
