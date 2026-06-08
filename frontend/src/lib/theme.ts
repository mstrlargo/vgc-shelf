export type ThemeName = "dark" | "light";
export type AccentColor = "blue" | "indigo" | "emerald" | "rose" | "amber" | "purple";

export const accentColors: Record<AccentColor, { label: string; rgb: string; borderRgb: string }> = {
  blue: { label: "Blue", rgb: "37 99 235", borderRgb: "37 99 235" },
  indigo: { label: "Indigo", rgb: "79 70 229", borderRgb: "79 70 229" },
  emerald: { label: "Emerald", rgb: "5 150 105", borderRgb: "5 150 105" },
  rose: { label: "Rose", rgb: "225 29 72", borderRgb: "225 29 72" },
  amber: { label: "Amber", rgb: "245 158 11", borderRgb: "245 158 11" },
  purple: { label: "Purple", rgb: "147 51 234", borderRgb: "147 51 234" }
};

const THEME_KEY = "vgc_theme";
const ACCENT_KEY = "vgc_accent_color";

export function getStoredTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" ? "light" : "dark";
}

export function getStoredAccent(): AccentColor {
  if (typeof window === "undefined") return "blue";
  const stored = localStorage.getItem(ACCENT_KEY) as AccentColor | null;
  if (stored && stored in accentColors) return stored;
  return "blue";
}

export function saveTheme(theme: ThemeName) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme, getStoredAccent());
}

export function saveAccentColor(accent: AccentColor) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCENT_KEY, accent);
  applyTheme(getStoredTheme(), accent);
}

export function applyTheme(theme: ThemeName = getStoredTheme(), accent: AccentColor = getStoredAccent()) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const selectedAccent = accentColors[accent] || accentColors.blue;

  root.dataset.theme = theme;
  root.dataset.accent = accent;
  root.style.setProperty("--vgc-accent-rgb", selectedAccent.rgb);
  root.style.setProperty("--vgc-accent", `rgb(${selectedAccent.rgb})`);
  root.style.setProperty("--vgc-accent-border", `rgb(${selectedAccent.borderRgb})`);

  if (theme === "light") {
    root.classList.add("vgc-light");
  } else {
    root.classList.remove("vgc-light");
  }
}
