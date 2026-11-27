const STEP = "200ms";

/** On big screens the bar sits narrower than the screen: the bubble slides from the bar's right end to the screen's corner. */
const SHIFT_TO_CORNER = "max(0px, calc((100vw - min(95vw, 42rem)) / 2 - var(--bar-gap)))";

/**
 * The bar folds into the bubble one way at a time: height, then width, then
 * the slide to the corner (`--slide`, zero where there's no room to slide).
 * Unfolding plays it backwards.
 */
export function barMotion(isBubble: boolean): React.CSSProperties {
  return {
    translate: isBubble ? SHIFT_TO_CORNER : "0px",
    transitionProperty: "width, translate, border-radius, background-color",
    transitionDuration: `${STEP}, ${STEP}, ${STEP}, 500ms`,
    transitionTimingFunction: "ease-in-out",
    transitionDelay: isBubble ? `${STEP}, calc(2 * ${STEP}), ${STEP}, 0ms` : "var(--slide), 0ms, var(--slide), 0ms",
  };
}

/** The row of the bar: its height goes first when folding, last when unfolding (in a room only, where it folds). */
export function rowMotion({ isBubble, isOpen, isInRoom }: { isBubble: boolean; isOpen: boolean; isInRoom: boolean }): React.CSSProperties {
  const isUnfolding = isInRoom && !isBubble && !isOpen;
  return {
    transitionProperty: "height, padding",
    transitionDuration: STEP,
    transitionTimingFunction: "ease-in-out",
    transitionDelay: isUnfolding ? `calc(var(--slide) + ${STEP})` : "0ms",
  };
}
