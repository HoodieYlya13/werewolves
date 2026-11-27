"use client";

import { useEffect, useState } from "react";
import { GROW_MS, type BubbleShape } from "./bubble-motion";

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
 * In a room, the bar rests as a bubble. Tapped, it grows into a circle as
 * tall as the bar, then into the bar itself, and
 * folds back once left alone for a moment, on a tap elsewhere, when scrolling
 * hides it, or when its panel closes.
 */
export function useBubble({ isInRoom, isOpen, isVisible, barRef }: BubbleOptions) {
  const [isUnfolded, setIsUnfolded] = useState(false);
  const [isGrown, setIsGrown] = useState(false);
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

  if (!isUnfolded && isGrown) setIsGrown(false);
  useGrowIntoBar(isInRoom && isUnfolded && !isGrown, setIsGrown);

  const isWaitingToFold = isInRoom && isUnfolded && !isOpen;
  useFoldAfterIdle(isWaitingToFold, lastTouch, setIsUnfolded);
  useFoldOnTapElsewhere(isWaitingToFold, barRef, setIsUnfolded);
  useFoldOncePanelClosed(isPanelClosing, setIsUnfolded, setIsPanelClosing);

  return {
    shape: shapeOf({ isInRoom, isOpen, isUnfolded, isGrown }),
    unfold: () => setIsUnfolded(true),
    keepUnfolded: () => setLastTouch(Date.now()),
  };
}

function shapeOf({ isInRoom, isOpen, isUnfolded, isGrown }: { isInRoom: boolean; isOpen: boolean; isUnfolded: boolean; isGrown: boolean }): BubbleShape {
  if (!isInRoom || isOpen) return "bar";
  if (!isUnfolded) return "bubble";
  return isGrown ? "bar" : "circle";
}

type SetUnfolded = (isUnfolded: boolean) => void;

/** Once the circle has grown (and slid back from the corner first, where it does), it stretches into the bar. */
function useGrowIntoBar(isGrowing: boolean, setIsGrown: (isGrown: boolean) => void) {
  useEffect(() => {
    if (!isGrowing) return;
    const timeout = setTimeout(() => setIsGrown(true), GROW_MS());
    return () => clearTimeout(timeout);
  }, [isGrowing, setIsGrown]);
}

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
