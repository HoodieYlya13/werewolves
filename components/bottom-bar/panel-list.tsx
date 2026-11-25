import { Children } from "react";

const STAGGER_MS = 75;

/** The rows of an open panel, rising in one after another each time the panel is shown. */
export function PanelList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex flex-col gap-3 p-2 pb-4">
      {Children.toArray(children).map((row, index) => (
        <li
          key={index}
          className="animate-in fade-in slide-in-from-bottom-10 fill-mode-both duration-500 ease-out"
          style={{ animationDelay: `${index * STAGGER_MS}ms` }}
        >
          {row}
        </li>
      ))}
    </ul>
  );
}
