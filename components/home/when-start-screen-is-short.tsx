"use client";

import { useEffect, useState } from "react";

type StartScreen = { width: number; height: number; hasInstallCard: boolean };

/** When the home's first screen shows the description under its title, sizes in rem: the same as `.start-screen-description` in globals.css. */
function hasRoomForDescription({ width, height, hasInstallCard }: StartScreen) {
  return height >= 44 || (width >= 44 && height >= 30) || (!hasInstallCard && height >= 36);
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
    const check = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const { width, height } = screen.getBoundingClientRect();
      setIsShort(!hasRoomForDescription({ width: width / rem, height: height / rem, hasInstallCard: !!screen.querySelector(".install-app") }));
    };
    // Its size changes with the screen; the install card shows up, or goes, once the browser says whether it can install.
    const resize = new ResizeObserver(check);
    const mutations = new MutationObserver(check);
    resize.observe(screen);
    mutations.observe(screen, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, []);

  return isShort ? children : null;
}
