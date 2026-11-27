/** "bubble": small, in the corner. "circle": as tall as the bar, at its right end, on its way to or from it. "bar": the whole bar. */
export type BubbleShape = "bubble" | "circle" | "bar";

/** Each step between two shapes. */
export const STEP_MS = 250;
const STEP = `${STEP_MS}ms`;

/** On big screens the bar sits narrower than the screen: the bubble slides from the bar's right end to the screen's corner. */
const SHIFT_TO_CORNER = "max(0px, calc((100vw - min(95vw, 42rem)) / 2 - var(--bar-gap)))";

/** A little further from the edges than the bar, clear of the screen's rounded corner. */
const BUBBLE_INSET = "0.375rem";

/** Its size, corners and place move together, within one step. */
export function barMotion(shape: BubbleShape): React.CSSProperties {
  return {
    translate: shape === "bubble" ? `calc(${SHIFT_TO_CORNER} - ${BUBBLE_INSET}) calc(-1 * ${BUBBLE_INSET})` : "0px",
    transitionProperty: "width, translate, border-radius",
    transitionDuration: STEP,
    transitionTimingFunction: "ease-in-out",
  };
}

/** The row's height, with the rest of the step. */
export const rowMotion: React.CSSProperties = {
  transitionProperty: "height, padding",
  transitionDuration: STEP,
  transitionTimingFunction: "ease-in-out",
};
