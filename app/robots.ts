import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // Rooms (host, play) and accounts (stats) only make sense to the people in them.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/*/host/", "/*/play/", "/*/stats"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
