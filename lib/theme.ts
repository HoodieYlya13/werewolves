/** "game" (the default) is dark during the game's nights and light during its days. */
export const themes = ["game", "auto", "light", "dark"] as const;
export type Theme = (typeof themes)[number];

export const THEME_KEY = "theme";

/**
 * Runs in <head> before first paint. `data-theme-choice` marks the chosen
 * option; `data-theme` forces light or dark. Left unset ("auto", or "game"
 * outside a game), CSS follows `prefers-color-scheme` with no JS.
 */
export const themeScript = `(function(){try{var r=document.documentElement,t=localStorage.getItem("${THEME_KEY}");if(t!=="auto"&&t!=="light"&&t!=="dark")t="game";r.setAttribute("data-theme-choice",t);if(t==="light"||t==="dark")r.setAttribute("data-theme",t)}catch(e){}})()`;

export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "auto" || value === "light" || value === "dark" ? value : "game";
  } catch {
    return "game";
  }
}

/** The phase of the game on screen, if any; set by the game screens. */
let gamePhase: "day" | "night" | null = null;

export function setGamePhase(phase: "day" | "night" | null) {
  // Nightfall and daybreak cross-fade; arriving on or leaving a game screen doesn't.
  const turn = gamePhase !== null && phase !== null && gamePhase !== phase;
  gamePhase = phase;
  const theme = readTheme();
  if (turn && theme === "game" && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(() => applyTheme(theme));
  } else {
    applyTheme(theme);
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme-choice", theme);
  const forced = theme === "game" ? (gamePhase && (gamePhase === "night" ? "dark" : "light")) : theme === "auto" ? null : theme;
  if (forced) root.setAttribute("data-theme", forced);
  else root.removeAttribute("data-theme");
}
