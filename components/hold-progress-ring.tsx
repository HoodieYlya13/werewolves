import { HOLD_TO_REVEAL_MS } from "@/hooks/use-hold-to-reveal";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring that fills while the finger holds, around whatever icon it wraps. */
export function HoldProgressRing({ isHolding, children, className = "" }: { isHolding: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative grid place-items-center rounded-full border-2 border-moon/30 bg-bg ${className}`}>
      <svg aria-hidden viewBox="0 0 100 100" className="absolute -inset-0.5 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke="var(--moon)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={isHolding ? 0 : CIRCUMFERENCE}
          style={{ transition: isHolding ? `stroke-dashoffset ${HOLD_TO_REVEAL_MS}ms linear` : "none" }}
        />
      </svg>
      {children}
    </span>
  );
}
