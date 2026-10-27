import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  typedRoutes: true,
  experimental: {
    // The build cache Vercel restores served a stylesheet compiled from the
    // previous commit's globals.css. Builds are quick enough without it.
    turbopackFileSystemCacheForBuild: false,
  },
  // Lets phones on the same Wi-Fi load the dev server by LAN IP.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
