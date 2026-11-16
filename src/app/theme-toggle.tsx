"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyThemeColor } from "@/lib/theme";

/**
 * Light/dark toggle. The actual theme class is applied before paint by the
 * inline script in layout.tsx; this just flips it and remembers the choice.
 *
 * Starts as `null` (unknown) so the server and first client render agree —
 * the real state is read from <html> in an effect after mount.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    applyThemeColor(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore unavailable storage (private mode, etc.)
    }
    setDark(next);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Thema wisselen"
      title="Licht / donker"
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
