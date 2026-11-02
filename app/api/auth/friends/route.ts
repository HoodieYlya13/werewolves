import { NextResponse, type NextRequest } from "next/server";
import { accountRoute } from "@/lib/account-route";
import { accountByCode, answerFriend, friendsList, removeFriend, requestFriend, saveAccount, type RequestResult } from "@/lib/friends";

/** The account's friends and requests (the friends page). Under /api/auth so it gets the sign-in cookies. */
export async function GET(request: NextRequest) {
  return accountRoute(request, async (account, url) => {
    await saveAccount(url, account);
    return NextResponse.json(await friendsList(url, account.sub));
  });
}

type Body =
  | { action: "request"; sub?: unknown; code?: unknown }
  | { action: "answer"; sub?: unknown; accept?: unknown }
  | { action: "remove"; sub?: unknown };

/** Asks someone (by account or friend link), answers a request, or ends a friendship. Answers with the new list. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const sub = typeof body?.sub === "string" && body.sub.length <= 200 ? body.sub : null;
  return accountRoute(request, async (account, url) => {
    await saveAccount(url, account);
    let result: RequestResult | undefined;
    if (body?.action === "request") {
      const to = typeof body.code === "string" && /^[A-Za-z0-9]{8}$/.test(body.code) ? (await accountByCode(url, body.code))?.sub : sub;
      result = to ? await requestFriend(url, account.sub, to) : "unknown";
    } else if (body?.action === "answer" && sub) {
      await answerFriend(url, account.sub, sub, body.accept === true);
    } else if (body?.action === "remove" && sub) {
      await removeFriend(url, account.sub, sub);
    } else {
      return NextResponse.json({ error: "invalid-request" }, { status: 400 });
    }
    return NextResponse.json({ result, list: await friendsList(url, account.sub) });
  });
}
