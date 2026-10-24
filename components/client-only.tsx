"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Renders `fallback` on the server and during hydration, `children` after. */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  return isClient ? children : fallback;
}
