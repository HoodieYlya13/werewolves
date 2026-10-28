import { NextResponse, type NextRequest } from "next/server";
import { authConfig, currentAccount, siteTicketKey } from "@/lib/auth";
import { isRoomCode } from "@/lib/room";
import { signTicket, type TicketAudience } from "@/lib/ticket";

/**
 * A ticket for one server: `{ room: "ABCD" }` for a room, `{ account: true }`
 * for the account server (it carries this device's sign-in). The ID token
 * stays here; the ticket says only who it is, for a minute.
 */
export async function POST(request: NextRequest) {
  const config = authConfig();
  const key = await siteTicketKey();
  if (!config || !key) return NextResponse.json({ error: "disabled" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { room?: unknown; account?: unknown } | null;
  const to: TicketAudience | null = body?.account === true ? "account" : typeof body?.room === "string" && isRoomCode(body.room) ? { room: body.room } : null;
  if (!to) return NextResponse.json({ error: "invalid-request" }, { status: 400 });

  const { account, sessionId, finish } = await currentAccount(request, config);
  if (!account) return finish(NextResponse.json({ error: "signed-out" }, { status: 401 }));
  const ticket = await signTicket(key, to, account, to === "account" ? sessionId : undefined);
  return finish(NextResponse.json({ ticket }, { headers: { "Cache-Control": "no-store" } }));
}
