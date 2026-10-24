import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, matchLocale } from "@/lib/i18n/config";

/** Sends locale-less URLs (`/`, `/play/ABCD`) to the saved or browser language. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) return;

  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : matchLocale(request.headers.get("accept-language"));
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip Next internals and any file with an extension (icons, manifest, sw.js…).
  matcher: ["/((?!_next|.*\\..*).*)"],
};
