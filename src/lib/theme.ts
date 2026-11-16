/**
 * The page background per theme, for <meta name="theme-color"> — it colours
 * the phone's status bar (and the title bar of the installed app) so it blends
 * into the page. Keep in step with --color-background in globals.css.
 */
export const THEME_COLORS = { light: "#f6f7f9", dark: "#0b1220" } as const;

/** Point the theme-color meta tag at the active theme. */
export function applyThemeColor(dark: boolean): void {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? THEME_COLORS.dark : THEME_COLORS.light);
}
