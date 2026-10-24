export const themes = ["auto", "light", "dark"] as const;
export type Theme = (typeof themes)[number];

export const THEME_KEY = "theme";

/**
 * Runs in <head> before first paint. Forced themes set `data-theme` on <html>;
 * "auto" leaves it unset so CSS follows `prefers-color-scheme` with no JS.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "auto";
  } catch {
    return "auto";
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}
