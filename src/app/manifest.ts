import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mindcraft",
    short_name: "Mindcraft",
    description: "A personal workspace you build your way.",
    start_url: "/workspace",
    scope: "/",
    display: "standalone",
    background_color: "#F8F3EC",
    theme_color: "#F8F3EC",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
