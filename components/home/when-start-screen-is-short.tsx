"use client";

import { useEffect, useState } from "react";

type StartScreen = { width: number; height: number; isInstalledApp: boolean };

/** When the home's first screen shows the description under its title, sizes in rem: the same as `.start-screen-description` in globals.css. */
function hasRoomForDescription({ width, height, isInstalledApp }: StartScreen) {
  return height >= 46 || (width >= 44 && height >= 30) || (isInstalledApp && height >= 36);
}

/**
 * Shown only while the home's first screen is too short for the description,
 * which then waits below it. The first screen's height follows the screen with
 * the browser's toolbars shown, so scrolling never flips it.
 */
export function WhenStartScreenIsShort({ children }: { children: React.ReactNode }) {
  const [isShort, setIsShort] = useState(true);

  useEffect(() => {
    const screen = document.querySelector(".first-screen-content");
    if (!screen) return;
    const isInstalledApp = matchMedia("(display-mode: standalone)").matches;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const observer = new ResizeObserver(([entry]) => setIsShort(!hasRoomForDescription({ width: entry.contentRect.width / rem, height: entry.contentRect.height / rem, isInstalledApp })));
    observer.observe(screen);
    return () => observer.disconnect();
  }, []);

  return isShort ? children : null;
}
