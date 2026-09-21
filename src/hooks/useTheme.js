import { useEffect, useState } from "react";

const STORAGE_KEY = "kasa-ilaya-theme";

function getSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "system";
  } catch {
    return "system";
  }
}

function writeStoredTheme(newTheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, newTheme);
  } catch {
    // Storage can be unavailable in some privacy modes; keep the in-memory state.
  }
}

function applyTheme(mode) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const resolved = mode === "system" ? getSystemTheme() : mode;
  root.classList.toggle("dark", resolved === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return readStoredTheme();
  });
  const [resolvedTheme, setResolvedTheme] = useState(() => {
    return theme === "system" ? getSystemTheme() : theme;
  });

  useEffect(() => {
    applyTheme(theme);
    setResolvedTheme(theme === "system" ? getSystemTheme() : theme);
  }, [theme]);

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (theme !== "system" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      applyTheme("system");
      setResolvedTheme(getSystemTheme());
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (newTheme) => {
    writeStoredTheme(newTheme);
    setThemeState(newTheme);
  };

  return { theme, resolvedTheme, setTheme };
}

// Apply theme immediately on script load (before React mounts) to avoid flash
applyTheme(readStoredTheme());
