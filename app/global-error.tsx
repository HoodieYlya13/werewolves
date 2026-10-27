"use client";

import { useEffect } from "react";
import "./globals.css";

/** The layout itself crashed, so there's no dictionary: both languages, plainly. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-background p-4 text-center font-sans text-foreground antialiased">
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg">Something went wrong. · Un problème est survenu.</p>
          <button type="button" className="rounded-md border px-5 py-2.5" onClick={retry}>
            Reload · Recharger
          </button>
        </div>
      </body>
    </html>
  );
}
