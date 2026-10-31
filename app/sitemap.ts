import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/config";
import { languageAlternates, publicPaths, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.8,
      alternates: { languages: languageAlternates(path) },
    })),
  );
}
