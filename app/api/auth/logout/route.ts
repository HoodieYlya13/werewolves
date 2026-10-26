import { NextResponse, type NextRequest } from "next/server";
import { discover } from "@/lib/account";
import { authConfig, clearTokens, loggedOutUrl, safeReturnTo, sitePath } from "@/lib/auth";

/** Signs out here and on the auth server, then comes back to `returnTo`. */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const config = authConfig();
  let target = sitePath(request, returnTo);
  if (config) {
    const { end_session_endpoint } = await discover(config.issuer).catch(() => ({ end_session_endpoint: undefined }));
    if (end_session_endpoint) {
      target = new URL(end_session_endpoint);
      // The auth server only accepts registered URLs, so the path rides in `state`.
      target.search = new URLSearchParams({ post_logout_redirect_uri: loggedOutUrl(request), state: returnTo, client_id: config.clientId }).toString();
    }
  }
  const response = NextResponse.redirect(target);
  clearTokens(request, response);
  return response;
}
