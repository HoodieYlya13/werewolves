import type { Metadata, Viewport } from "next";
import { Cinzel, Geist } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccountButton } from "@/components/account-button";
import { I18nProvider } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ResumeRooms } from "@/components/resume-rooms";
import { SessionGuard } from "@/components/session-guard";
import { SiteTitle } from "@/components/site-title";
import { Toaster } from "@/components/ui/sonner";
import { PasskeyReminder } from "@/components/passkey-reminder";
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
    appleWebApp: { capable: true, title: dict.app.name, statusBarStyle: "default" },
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
          <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <SiteTitle />
              <div className="flex items-center gap-2">
                <LocaleSwitcher />
                <AccountButton accounts={!!process.env.AUTH_CLIENT_ID && !!process.env.AUTH_CLIENT_SECRET} />
              </div>
            </header>
            <ResumeRooms />
            {children}
            {/* Down here, so the header has room for the account on phones. */}
            <footer className="flex flex-col items-center gap-3 px-4 py-4">
              {/* Every page links to the guides: people find them, and so do search engines. */}
              <nav aria-label={dict.nav.label} className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <Link href={`/${locale}/rules`} className="hover:text-fg">
                  {dict.nav.rules}
                </Link>
                <Link href={`/${locale}/roles`} className="hover:text-fg">
                  {dict.nav.roles}
                </Link>
                <Link href={`/${locale}/faq`} className="hover:text-fg">
                  {dict.nav.faq}
                </Link>
              </nav>
              <ThemeSwitcher />
            </footer>
          </div>
          <Toaster position="top-center" />
          <SessionGuard />
          {/* It reads the URL, which only exists at runtime: kept out of the prerendered shell. */}
          <Suspense fallback={null}>
            <PasskeyReminder />
          </Suspense>
        </I18nProvider>
      </body>
    </html>
  );
}
