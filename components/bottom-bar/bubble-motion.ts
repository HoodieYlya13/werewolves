/** "bubble": folded in the corner. "circle": grown as tall as the bar, on its way to it. "bar": the whole bar. */
export type BubbleShape = "bubble" | "circle" | "bar";

const STEP_MS = 200;
const STEP = `${STEP_MS}ms`;

/** Where the bar is narrower than the screen, so the bubble slides to the corner: the same width as `min-[44.25rem]` in the bar's classes. */
const SLIDES_TO_CORNER = "(min-width: 44.25rem)";

/** How long the circle takes to come back from the corner and grow, before it stretches into the bar. */
export const GROW_MS = () => STEP_MS + (window.matchMedia(SLIDES_TO_CORNER).matches ? STEP_MS : 0);

/** On big screens the bar sits narrower than the screen: the bubble slides from the bar's right end to the screen's corner. */
const SHIFT_TO_CORNER = "max(0px, calc((100vw - min(95vw, 42rem)) / 2 - var(--bar-gap)))";

/** Delays for width, translate and border-radius: one way at a time (`--slide` is zero where there's no room to slide). */
const DELAYS: Record<BubbleShape, string> = {
  // Folding: the height goes first (the row), then the width, then the slide.
  bubble: `${STEP}, calc(2 * ${STEP}), ${STEP}`,
  // Unfolding: back from the corner, then the circle grows.
  circle: "var(--slide), 0ms, var(--slide)",
  // The circle stretches into the bar.
  bar: "0ms, 0ms, 0ms",
};

export function barMotion(shape: BubbleShape): React.CSSProperties {
  return {
    translate: shape === "bubble" ? SHIFT_TO_CORNER : "0px",
    transitionProperty: "width, translate, border-radius",
    transitionDuration: STEP,
    transitionTimingFunction: "ease-in-out",
    transitionDelay: DELAYS[shape],
  };
}

/** The row's height: first when folding, with the circle's growth when unfolding. */
export function rowMotion(shape: BubbleShape): React.CSSProperties {
  return {
    transitionProperty: "height, padding",
    transitionDuration: STEP,
    transitionTimingFunction: "ease-in-out",
    transitionDelay: shape === "circle" ? "var(--slide)" : "0ms",
  };
}
