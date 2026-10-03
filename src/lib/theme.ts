import type { ThemeChoice } from "@/lib/model";

export const THEME_KEY = "artlink-theme";

export function resolveTheme(choice: string): "dark" | "light" {
  if (choice === "light") return "light";
  if (choice === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return choice === "system" ? "dark" : "dark";
}

export function applyTheme(choice: ThemeChoice | string) {
  const safe: ThemeChoice = choice === "light" || choice === "system" ? choice : "dark";
  document.documentElement.dataset.theme = resolveTheme(safe);
  document.documentElement.dataset.choice = safe;
  try {
    localStorage.setItem(THEME_KEY, safe);
  } catch {
    /* ignore */
  }
}

export function storedTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "system" || value === "dark") return value;
  } catch {
    /* ignore */
  }
  return "dark";
}
