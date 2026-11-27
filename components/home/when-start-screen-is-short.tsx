"use client";

import { useEffect, useState } from "react";

/** When the home's first screen shows the description under its title: the same as `.start-screen-description` in globals.css. */
function hasRoomForDescription(width: number, height: number) {
  return height >= 44 || (width >= 44 && height >= 30);
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
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const observer = new ResizeObserver(([entry]) => setIsShort(!hasRoomForDescription(entry.contentRect.width / rem, entry.contentRect.height / rem)));
    observer.observe(screen);
    return () => observer.disconnect();
  }, []);

  return isShort ? children : null;
}
