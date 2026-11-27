"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

/** The home page (`/en`, `/fr`), whose first screen is where a game starts. */
const isHomePath = (pathname: string) => /^\/[a-z]{2}\/?$/.test(pathname);

const START_SCREEN = ".first-screen-content";

/**
 * Back to the home's first screen, where a game is created or joined, from
 * anywhere outside a room. Hidden while that screen is in view. It navigates
 * or scrolls in code, so the address never keeps an anchor.
 */
export function StartGameButton({ pathname, isInRoom }: { pathname: string; isInRoom: boolean }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const isHome = isHomePath(pathname);
  const isStartScreenInView = useIsStartScreenInView(isHome);
  const isShown = !isInRoom && !(isHome && isStartScreenInView);

  function goToStartScreen() {
    if (isHome) window.scrollTo({ top: 0, behavior: "smooth" });
    else router.push(`/${locale}`);
  }

  return (
    <button
      type="button"
      onClick={goToStartScreen}
      aria-label={dict.bar.startGame}
      aria-hidden={!isShown}
      tabIndex={isShown ? undefined : -1}
      className={`grid h-16 shrink-0 place-items-center overflow-hidden transition-[width,opacity,scale] duration-300 hover:opacity-70 active:scale-90 md:h-20 ${isShown ? "w-12 opacity-100 md:w-14" : "pointer-events-none w-0 opacity-0"}`}
    >
      <Play aria-hidden className="size-6 md:size-7" />
    </button>
  );
}

/** Whether at least half of the home's first screen shows. The page may render after the bar: it waits for it. */
function useIsStartScreenInView(isHome: boolean) {
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    if (!isHome) return;
    const intersection = new IntersectionObserver(([entry]) => setIsInView(entry.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    const observeWhenThere = () => {
      const screen = document.querySelector(START_SCREEN);
      if (!screen) return false;
      intersection.observe(screen);
      return true;
    };
    const mutations = new MutationObserver(() => {
      if (observeWhenThere()) mutations.disconnect();
    });
    if (!observeWhenThere()) mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      intersection.disconnect();
      mutations.disconnect();
    };
  }, [isHome]);

  return isInView;
}
