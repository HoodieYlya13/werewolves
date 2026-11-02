import { NextResponse, type NextRequest } from "next/server";
import { authConfig, currentAccount } from "@/lib/auth";
import { claimGuestSeats } from "@/lib/stats";

/** As many codes as a device keeps (MAX_GUEST_GAMES). */
const MAX_CODES = 50;
const CODE = /^[0-9a-f-]{36}$/;

/**
 * Guest seats this device played, for the signed-in account: the body is the
 * claim codes the rooms sent it (lib/guest-games.ts). Under /api/auth so it
 * gets the sign-in cookies.
 */
export async function POST(request: NextRequest) {
  const config = authConfig();
  const url = process.env.POSTGRES_URL;
  if (!config || !url) return NextResponse.json({ error: "disabled" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { codes?: unknown } | null;
  const codes = Array.isArray(body?.codes) ? body.codes.filter((c): c is string => typeof c === "string" && CODE.test(c)) : [];
  if (!codes.length || codes.length > MAX_CODES) return NextResponse.json({ error: "invalid-request" }, { status: 400 });

  const { account, finish } = await currentAccount(request, config);
  if (!account) return finish(NextResponse.json({ error: "signed-out" }, { status: 401 }));
  const claimed = await claimGuestSeats(url, account.sub, [...new Set(codes)]);
  return finish(NextResponse.json({ claimed }, { headers: { "Cache-Control": "no-store" } }));
}
