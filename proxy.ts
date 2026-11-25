import { NextResponse, type NextRequest } from "next/server";
import { pathLocale, preferredLocale } from "@/lib/i18n/config";

/** Sends locale-less URLs (`/`, `/play/ABCD`) to the saved or browser language. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathLocale(pathname)) return;

  const locale = preferredLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip Next internals, API routes and any file with an extension (icons, manifest, sw.js…).
  matcher: ["/((?!_next|api/|.*\\..*).*)"],
};
