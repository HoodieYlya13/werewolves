export type MenuIconShape = "dots" | "lines" | "cross";

type BarShape = { top: string; width: string; height: string; rotate: number; opacity: number };

const DOT = { width: "16.7%", height: "16.7%" };
const LINE = { width: "66.7%", height: "8.3%" };
const CROSS_LINE = { width: "75%", height: "8.3%" };

/** The three bars of each shape, top to bottom: a dot is a short line, and the cross is the top and bottom lines turned. */
const SHAPES: Record<MenuIconShape, [BarShape, BarShape, BarShape]> = {
  dots: [
    { top: "25%", ...DOT, rotate: 0, opacity: 1 },
    { top: "50%", ...DOT, rotate: 0, opacity: 1 },
    { top: "75%", ...DOT, rotate: 0, opacity: 1 },
  ],
  lines: [
    { top: "25%", ...LINE, rotate: 0, opacity: 1 },
    { top: "50%", ...LINE, rotate: 0, opacity: 1 },
    { top: "75%", ...LINE, rotate: 0, opacity: 1 },
  ],
  cross: [
    { top: "50%", ...CROSS_LINE, rotate: 45, opacity: 1 },
    { top: "50%", width: "0%", height: "8.3%", rotate: 0, opacity: 0 },
    { top: "50%", ...CROSS_LINE, rotate: -45, opacity: 1 },
  ],
};

/** Vertical dots that stretch into a burger, whose lines turn into a cross. */
export function MenuIcon({ shape, className = "" }: { shape: MenuIconShape; className?: string }) {
  return (
    <span aria-hidden className={`relative block ${className}`}>
      {SHAPES[shape].map((bar, index) => (
        <span
          key={index}
          className="absolute left-1/2 rounded-full bg-current transition-[top,width,height,transform,opacity] duration-300 ease-in-out"
          style={{
            top: bar.top,
            width: bar.width,
            height: bar.height,
            opacity: bar.opacity,
            transform: `translate(-50%, -50%) rotate(${bar.rotate}deg)`,
          }}
        />
      ))}
    </span>
  );
}
