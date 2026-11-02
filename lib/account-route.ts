import { NextResponse, type NextRequest } from "next/server";
import type { Account } from "./account";
import { authConfig, currentAccount } from "./auth";

/**
 * A route for the signed-in account that needs the database (friends,
 * invites, push): 404 when either is off, 401 when signed out.
 */
export async function accountRoute(request: NextRequest, run: (account: Account, url: string) => Promise<NextResponse>) {
  const config = authConfig();
  const url = process.env.POSTGRES_URL;
  if (!config || !url) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const { account, finish } = await currentAccount(request, config);
  if (!account) return finish(NextResponse.json({ error: "signed-out" }, { status: 401 }));
  const response = await run(account, url);
  response.headers.set("Cache-Control", "private, no-store");
  return finish(response);
}
