import type { Metadata, Viewport } from "next";
import { Cinzel, Geist } from "next/font/google";
import Link from "next/link";
import { I18nProvider } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { locales } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
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
    title: { default: dict.app.name, template: `%s · ${dict.app.name}` },
    description: dict.app.tagline,
    applicationName: dict.app.name,
    appleWebApp: { capable: true, title: dict.app.name, statusBarStyle: "black-translucent" },
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])) },
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
              <Link href={`/${locale}`} className="font-display text-lg font-bold tracking-wide">
                {dict.app.name}
              </Link>
              <div className="flex items-center gap-2">
                <LocaleSwitcher />
                <ThemeSwitcher />
              </div>
            </header>
            {children}
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
