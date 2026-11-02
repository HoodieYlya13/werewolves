import { NextResponse, type NextRequest } from "next/server";
import { accountRoute } from "@/lib/account-route";
import { recentInvites } from "@/lib/friends";

/** The account's recent invites: the service worker shows the newest when a push arrives (it carries nothing). */
export async function GET(request: NextRequest) {
  return accountRoute(request, async (account, url) => NextResponse.json({ invites: await recentInvites(url, account.sub) }));
}
