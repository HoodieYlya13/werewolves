import { connection, NextResponse, type NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/account";
import { authConfig } from "@/lib/auth";
import { accountStats } from "@/lib/stats";

/** The signed-in account's stats. The page proves the account with its ID token (see lib/session.ts). */
export async function GET(request: NextRequest) {
  await connection();
  const config = authConfig();
  const url = process.env.POSTGRES_URL;
  if (!config || !url) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  const account = await verifyIdToken(token, config);
  if (!account) return NextResponse.json({ error: "invalid-account" }, { status: 401 });
  return NextResponse.json(await accountStats(url, account.sub), { headers: { "Cache-Control": "private, no-store" } });
}
