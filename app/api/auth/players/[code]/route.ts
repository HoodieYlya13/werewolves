import { connection, NextResponse, type NextRequest } from "next/server";
import { authConfig, currentAccount } from "@/lib/auth";
import { accountByCode } from "@/lib/friends";
import { accountStats, headToHead } from "@/lib/stats";

/**
 * A player's public profile: their stats, open to anyone. Signed in (it's
 * under /api/auth for the cookies), it adds how the viewer fares against them.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/auth/players/[code]">) {
  await connection();
  const url = process.env.POSTGRES_URL;
  if (!url) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const { code } = await ctx.params;
  const person = /^[A-Za-z0-9]{8}$/.test(code) ? await accountByCode(url, code) : null;
  if (!person) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const config = authConfig();
  const viewer = config ? await currentAccount(request, config) : null;
  const me = viewer?.account?.sub ?? null;
  const [stats, versus] = await Promise.all([accountStats(url, person.sub), me && me !== person.sub ? headToHead(url, me, person.sub) : null]);
  const response = NextResponse.json(
    { person: { name: person.name, username: person.username, picture: person.picture, code: person.code }, self: me === person.sub, stats, headToHead: versus },
    { headers: { "Cache-Control": "private, no-store" } },
  );
  return viewer ? viewer.finish(response) : response;
}
