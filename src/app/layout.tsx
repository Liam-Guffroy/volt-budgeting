import type { Metadata } from "next";
import { THEME_COLORS } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vlot — budgetplanner",
  description: "Wat houd ik over, en hoeveel moet ik reserveren?",
  applicationName: "Vlot",
  // iOS: open full-screen from the home screen, under the name "Vlot". The
  // manifest (manifest.ts) and the touch icon (apple-icon.png) are linked by
  // Next from their file names.
  appleWebApp: { capable: true, title: "Vlot", statusBarStyle: "default" },
};

// Runs before first paint so the saved theme is applied with no light-mode
// flash. Falls back to the OS preference when the user hasn't chosen yet. Also
// points the theme-color meta tag (rendered just above it) at the dark
// background, so the phone's status bar matches the page.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var dark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(dark){document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','${THEME_COLORS.dark}');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl-BE" suppressHydrationWarning>
      <head>
        {/* The script below may re-point this before hydration. */}
        <meta name="theme-color" content={THEME_COLORS.light} suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
