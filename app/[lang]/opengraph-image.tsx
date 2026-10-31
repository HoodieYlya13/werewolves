import { ImageResponse } from "next/og";
import { isLocale, locales } from "@/lib/i18n/config";
import en from "@/lib/i18n/dictionaries/en";
import fr from "@/lib/i18n/dictionaries/fr";
import { SITE_URL } from "@/lib/seo";

export const alt = "Werewolves · Loups-Garous";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Drawn once per language at build time.
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

/** The card shown when a page is shared: a moon over the name, in the page's language. */
export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const dict = isLocale(lang) && lang === "fr" ? fr : en;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "radial-gradient(circle at 50% 30%, #2a2240 0%, #0d0b13 65%)",
          color: "#f1ece2",
          padding: 80,
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: 999,
            background: "radial-gradient(circle at 38% 38%, #fbeec4 0%, #f2d58a 55%, #c9962b 100%)",
            boxShadow: "0 0 120px 30px rgba(242, 213, 138, 0.35)",
          }}
        />
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: 4 }}>{dict.app.name}</div>
        <div style={{ fontSize: 32, color: "#b9b2c4", textAlign: "center", maxWidth: 920, lineHeight: 1.35 }}>{dict.app.tagline}</div>
        <div style={{ fontSize: 26, color: "#f2d58a", marginTop: 12 }}>{SITE_URL.replace(/^https?:\/\//, "")}</div>
      </div>
    ),
    size,
  );
}
