import { encode } from "uqr";

/** QR code drawn in `currentColor`, so it follows the theme. */
export function QrCode({ value, className }: { value: string; className?: string }) {
  const { data, size } = encode(value, { border: 1 });
  let path = "";
  data.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} shapeRendering="crispEdges" aria-hidden>
      <path d={path} fill="currentColor" />
    </svg>
  );
}
