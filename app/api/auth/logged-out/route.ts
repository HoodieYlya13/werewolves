import { NextResponse, type NextRequest } from "next/server";
import { safeReturnTo, sitePath } from "@/lib/auth";

/** Where the auth server sends the browser after signing out; `state` holds the page to go back to. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(sitePath(request, safeReturnTo(request.nextUrl.searchParams.get("state"))));
}
