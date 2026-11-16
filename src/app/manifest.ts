import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/lib/theme";

/**
 * Web app manifest (served at /manifest.webmanifest): lets a phone install
 * Vlot to the home screen and open it full-screen, without the browser bars.
 *
 * There is deliberately no service worker: every page is rendered per request
 * from the database behind a login, so there is nothing useful to show offline.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vlot — budgetplanner",
    short_name: "Vlot",
    description: "Wat houd ik over, en hoeveel moet ik reserveren?",
    lang: "nl-BE",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The splash screen while the app starts; the status bar follows the
    // theme-color meta tag once a page has loaded.
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed versions the launcher may crop to its own shape.
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the home-screen icon to jump straight to a page.
    shortcuts: [
      { name: "Statistieken", url: "/statistieken" },
      { name: "Jaaroverzicht", url: "/jaar" },
      { name: "Zoeken", url: "/zoeken" },
    ],
  };
}
