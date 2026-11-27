"use client";

import { useEffect, useState } from "react";
import { STEP_MS, type BubbleShape } from "./bubble-motion";

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
 * In a room, the bar rests as a bubble in the corner. Tapped, it grows into
 * a circle as tall as the bar on its way back from the corner, then stretches
 * into the bar; it folds back the same way once left alone for a moment, on
 * a tap elsewhere, when scrolling hides it, or when its panel closes.
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

  const target: BubbleShape = !isInRoom || isOpen || isUnfolded ? "bar" : "bubble";
  const [shape, setShape] = useState<BubbleShape>(target);
  // A panel opens on the whole bar at once; leaving or entering a room steps through the circle like a tap.
  if (isOpen && shape !== "bar") setShape("bar");
  useStepToward(shape, target, setShape);

  const isWaitingToFold = isInRoom && isUnfolded && !isOpen;
  useFoldAfterIdle(isWaitingToFold, lastTouch, setIsUnfolded);
  useFoldOnTapElsewhere(isWaitingToFold, barRef, setIsUnfolded);
  useFoldOncePanelClosed(isPanelClosing, setIsUnfolded, setIsPanelClosing);

  return {
    shape,
    unfold: () => setIsUnfolded(true),
    keepUnfolded: () => setLastTouch(Date.now()),
  };
}

type SetUnfolded = (isUnfolded: boolean) => void;

/** One step at a time through the circle: a step starts at once from either end, and once the circle is reached from the middle. */
function useStepToward(shape: BubbleShape, target: BubbleShape, setShape: (shape: BubbleShape) => void) {
  useEffect(() => {
    if (shape === target) return;
    const isInTheMiddle = shape === "circle";
    const timeout = setTimeout(() => setShape(isInTheMiddle ? target : "circle"), isInTheMiddle ? STEP_MS : 0);
    return () => clearTimeout(timeout);
  }, [shape, target, setShape]);
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
