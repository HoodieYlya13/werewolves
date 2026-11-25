"use client";

import { useEffect, useRef, useState } from "react";

const NEAR_TOP_PX = 50;
const BOTTOM_TOLERANCE_PX = 10;
const WHEEL_THRESHOLD = 5;
const SWIPE_THRESHOLD_PX = 15;

function isPageScrollable(): boolean {
  return document.documentElement.scrollHeight > window.innerHeight + BOTTOM_TOLERANCE_PX;
}

function isAtPageBottom(): boolean {
  return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - BOTTOM_TOLERANCE_PX;
}

/**
 * Whether a bottom bar should show: hidden at the bottom of the page (where the
 * footer is), back on scrolling up or near the top. On pages that don't scroll,
 * a swipe or wheel turn up hides it and down shows it.
 */
export function useHideOnScroll(): boolean {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const isScrollingUp = scrollY < lastScrollY.current;
      lastScrollY.current = scrollY;
      if (!isPageScrollable()) return;
      if (isAtPageBottom()) setIsVisible(false);
      else if (isScrollingUp || scrollY < NEAR_TOP_PX) setIsVisible(true);
    };

    const onWheel = (event: WheelEvent) => {
      if (isPageScrollable()) return;
      if (event.deltaY > WHEEL_THRESHOLD) setIsVisible(false);
      else if (event.deltaY < -WHEEL_THRESHOLD) setIsVisible(true);
    };

    let touchStartY = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0].clientY;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (isPageScrollable()) return;
      const swipe = event.touches[0].clientY - touchStartY;
      if (swipe < -SWIPE_THRESHOLD_PX) setIsVisible(false);
      else if (swipe > SWIPE_THRESHOLD_PX) setIsVisible(true);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return isVisible;
}
