import type { Metadata, Viewport } from "next";
import { Cinzel, Geist } from "next/font/google";
import { Suspense } from "react";
import { SignInFailureToast } from "@/components/account-button";
import { BottomBar } from "@/components/bottom-bar/bottom-bar";
import { I18nProvider } from "@/components/i18n-provider";
import { ResumeRooms } from "@/components/resume-rooms";
import { SessionGuard } from "@/components/session-guard";
import { Toaster } from "@/components/ui/sonner";
import { PasskeyReminder } from "@/components/passkey-reminder";
import { ClaimGuestGames } from "@/components/guest-games";
import { PushReminder } from "@/components/friends/push-reminder";
import { locales } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { SITE_URL } from "@/lib/seo";
import { themeScript } from "@/lib/theme";
import "../globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const display = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: dict.seo.home.title, template: `%s · ${dict.app.name}` },
    description: dict.seo.home.description,
    applicationName: dict.app.name,
    appleWebApp: { capable: true, title: dict.app.name, statusBarStyle: "black-translucent" },
    openGraph: { siteName: dict.app.name, type: "website" },
    twitter: { card: "summary_large_image" },
    category: "games",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0b13" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <html
      lang={locale}
      className={`${sans.variable} ${display.variable}`}
      // The inline theme script adds data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        <I18nProvider locale={locale} dict={dict}>
          {/* No header any more: the gap it left at the top, and the bar floats over the end of a page as it hides there. */}
          <div className="flex min-h-dvh flex-col pt-(--page-top) pb-[env(safe-area-inset-bottom)]">
            <ResumeRooms />
            {children}
          </div>
          <BottomBar />
          <Toaster position="top-center" />
          <SignInFailureToast />
          <SessionGuard />
          {/* It reads the URL, which only exists at runtime: kept out of the prerendered shell. */}
          <Suspense fallback={null}>
            <PasskeyReminder />
            <PushReminder />
          </Suspense>
          <ClaimGuestGames />
        </I18nProvider>
      </body>
    </html>
  );
}
