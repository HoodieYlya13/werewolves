"use client";

import { useEffect, useState } from "react";

const FOLD_AFTER_MS = 4000;
/** The panel's own closing time: the bar folds only once it has. */
const PANEL_CLOSE_MS = 500;

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

  const [isPanelClosing, setIsPanelClosing] = useState(false);
  if (shownOpen !== isOpen) {
    setShownOpen(isOpen);
    setIsPanelClosing(!isOpen);
  }
  if (shownVisible !== isVisible) {
    setShownVisible(isVisible);
    if (!isVisible) setIsUnfolded(false);
  }

  const isWaitingToFold = isInRoom && isUnfolded && !isOpen;
  useFoldAfterIdle(isWaitingToFold, lastTouch, setIsUnfolded);
  useFoldOnTapElsewhere(isWaitingToFold, barRef, setIsUnfolded);
  useFoldOncePanelClosed(isPanelClosing, setIsUnfolded, setIsPanelClosing);

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

/** Closing its panel folds the bar too, once the panel is gone: one way at a time. */
function useFoldOncePanelClosed(isPanelClosing: boolean, setIsUnfolded: SetUnfolded, setIsPanelClosing: (isClosing: boolean) => void) {
  useEffect(() => {
    if (!isPanelClosing) return;
    const timeout = setTimeout(() => {
      setIsUnfolded(false);
      setIsPanelClosing(false);
    }, PANEL_CLOSE_MS);
    return () => clearTimeout(timeout);
  }, [isPanelClosing, setIsUnfolded, setIsPanelClosing]);
}
