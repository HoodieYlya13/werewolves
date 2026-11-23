"use client";

import { useEffect, useRef, useState } from "react";

export const HOLD_TO_REVEAL_MS = 1_000;

/** Revealed once held for HOLD_TO_REVEAL_MS, hidden again the moment it's let go (or the page hides). */
export function useHoldToReveal(onReveal?: () => void) {
  const [isHolding, setIsHolding] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const timer = useRef<number | null>(null);
  const revealed = useRef(onReveal);
  useEffect(() => {
    revealed.current = onReveal;
  });

  function start() {
    if (timer.current !== null) return;
    setIsHolding(true);
    timer.current = window.setTimeout(() => {
      setIsRevealed(true);
      revealed.current?.();
    }, HOLD_TO_REVEAL_MS);
  }

  function stop() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setIsHolding(false);
    setIsRevealed(false);
  }

  useEffect(() => {
    const hide = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      setIsHolding(false);
      setIsRevealed(false);
    };
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", hide);
      hide();
    };
  }, []);

  const handlers = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      start();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      start();
    },
    onKeyUp: stop,
    onBlur: stop,
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => event.preventDefault(),
  };

  return { isHolding, isRevealed, handlers };
}
