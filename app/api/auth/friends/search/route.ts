import { NextResponse, type NextRequest } from "next/server";
import { accountRoute } from "@/lib/account-route";
import { searchAccounts } from "@/lib/friends";

/** Accounts by username, to add as friends (?q=, at least 2 characters). */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 40);
  return accountRoute(request, async (account, url) =>
    NextResponse.json({ people: query.length >= 2 ? await searchAccounts(url, account.sub, query) : [] }),
  );
}
