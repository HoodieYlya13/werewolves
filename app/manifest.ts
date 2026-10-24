import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Werewolves · Loups-Garous",
    short_name: "Werewolves",
    description: "The game master's companion for Werewolves and other hidden-role games.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d0b13",
    theme_color: "#0d0b13",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
