import { connection, NextResponse, type NextRequest } from "next/server";
import { authConfig, currentAccount } from "@/lib/auth";
import { accountStats } from "@/lib/stats";

/** The signed-in account's stats. Under /api/auth so it gets the sign-in cookies. */
export async function GET(request: NextRequest) {
  await connection();
  const config = authConfig();
  const url = process.env.POSTGRES_URL;
  if (!config || !url) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const { account, finish } = await currentAccount(request, config);
  if (!account) return finish(NextResponse.json({ error: "signed-out" }, { status: 401 }));
  return finish(NextResponse.json(await accountStats(url, account.sub), { headers: { "Cache-Control": "private, no-store" } }));
}
