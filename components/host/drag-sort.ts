"use client";

import { useState, type CSSProperties, type PointerEvent } from "react";

type Drag = {
  from: number;
  /** Where the row would land if dropped now. */
  to: number;
  /** How far the pointer moved since it went down. */
  dy: number;
  startY: number;
  /** Each row's vertical middle when the drag started. */
  mids: number[];
  /** From one row's top to the next one's: how far rows shift to make room. */
  step: number;
};

const SHIFT = "transform 150ms ease";

/**
 * Drag to reorder a vertical list (<ol> or <ul>), with a mouse or a finger,
 * from a handle in each row. The other rows make room as the dragged one
 * passes, and `onMove(from, to)` runs on drop.
 */
export function useDragSort(onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);

  function handleProps(index: number) {
    return {
      style: { touchAction: "none" } satisfies CSSProperties,
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (e.button !== 0) return;
        const rows = [...(e.currentTarget.closest("ol, ul")?.children ?? [])].map((el) => el.getBoundingClientRect());
        if (!rows[index]) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const step = rows.length > 1 ? rows[1].top - rows[0].top : rows[index].height;
        setDrag({ from: index, to: index, dy: 0, startY: e.clientY, mids: rows.map((r) => r.top + r.height / 2), step });
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        if (!drag) return;
        const dy = e.clientY - drag.startY;
        const middle = drag.mids[drag.from] + dy;
        const to = drag.mids.filter((mid, i) => i !== drag.from && mid < middle).length;
        setDrag({ ...drag, dy, to });
      },
      onPointerUp() {
        if (drag && drag.to !== drag.from) onMove(drag.from, drag.to);
        setDrag(null);
      },
      onPointerCancel() {
        setDrag(null);
      },
    };
  }

  /** Where each row sits while dragging: the dragged one follows the pointer. */
  function rowStyle(index: number): CSSProperties | undefined {
    if (!drag) return undefined;
    if (index === drag.from) return { transform: `translateY(${drag.dy}px)`, position: "relative", zIndex: 10 };
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return { transform: `translateY(${-drag.step}px)`, transition: SHIFT };
    if (drag.to < drag.from && index >= drag.to && index < drag.from) return { transform: `translateY(${drag.step}px)`, transition: SHIFT };
    return { transition: SHIFT };
  }

  return { handleProps, rowStyle, dragging: drag?.from ?? null };
}
