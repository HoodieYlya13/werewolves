"use client";

import { useEffect, useState } from "react";

const FOLD_AFTER_MS = 4000;

type BubbleOptions = {
  isInRoom: boolean;
  isOpen: boolean;
  isVisible: boolean;
  barRef: React.RefObject<HTMLElement | null>;
};

/**
 * In a room, the bar rests as a bubble. Tapped, it unfolds into the bar, and
 * folds back once left alone for a moment, on a tap elsewhere, when scrolling
 * hides it, or when its panel closes.
 */
export function useBubble({ isInRoom, isOpen, isVisible, barRef }: BubbleOptions) {
  const [isUnfolded, setIsUnfolded] = useState(false);
  const [lastTouch, setLastTouch] = useState(0);
  const [shownOpen, setShownOpen] = useState(isOpen);
  const [shownVisible, setShownVisible] = useState(isVisible);

  if (shownOpen !== isOpen) {
    setShownOpen(isOpen);
    if (!isOpen) setIsUnfolded(false);
  }
  if (shownVisible !== isVisible) {
    setShownVisible(isVisible);
    if (!isVisible) setIsUnfolded(false);
  }

  const isWaitingToFold = isInRoom && isUnfolded && !isOpen;
  useFoldAfterIdle(isWaitingToFold, lastTouch, setIsUnfolded);
  useFoldOnTapElsewhere(isWaitingToFold, barRef, setIsUnfolded);

  return {
    isBubble: isInRoom && !isOpen && !isUnfolded,
    unfold: () => setIsUnfolded(true),
    keepUnfolded: () => setLastTouch(Date.now()),
  };
}

type SetUnfolded = (isUnfolded: boolean) => void;

/** The timer restarts on each touch of the bar. */
function useFoldAfterIdle(isWaiting: boolean, lastTouch: number, setIsUnfolded: SetUnfolded) {
  useEffect(() => {
    if (!isWaiting) return;
    const timeout = setTimeout(() => setIsUnfolded(false), FOLD_AFTER_MS);
    return () => clearTimeout(timeout);
  }, [isWaiting, lastTouch, setIsUnfolded]);
}

function useFoldOnTapElsewhere(isWaiting: boolean, barRef: React.RefObject<HTMLElement | null>, setIsUnfolded: SetUnfolded) {
  useEffect(() => {
    if (!isWaiting) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setIsUnfolded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isWaiting, barRef, setIsUnfolded]);
}
