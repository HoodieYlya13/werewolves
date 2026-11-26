import { NextResponse, type NextRequest } from "next/server";
import { purgeAccounts } from "@/lib/account-purge";
import { authConfig, deletedAccountsOnAuthServer } from "@/lib/auth";

/**
 * Daily (vercel.json): deletes the data of the accounts the auth server
 * deleted. It answers the last 90 days every time, so a missed day catches up.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = authConfig();
  const url = process.env.POSTGRES_URL;
  if (!config || !url) return NextResponse.json({ skipped: "accounts or database off" });

  const subs = await deletedAccountsOnAuthServer(config);
  if (!subs) return NextResponse.json({ error: "the auth server didn't answer" }, { status: 502 });
  await purgeAccounts(url, subs);
  return NextResponse.json({ purged: subs.length });
}
