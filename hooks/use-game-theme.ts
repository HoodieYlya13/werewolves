"use client";

import { useEffect } from "react";
import { setGamePhase } from "@/lib/theme";

/** Lets the "game" theme follow this screen's game: dark at night, light by day. */
export function useGameTheme(isNight: boolean) {
  useEffect(() => setGamePhase(isNight ? "night" : "day"), [isNight]);
  // Leaving the game screen hands the theme back to the device setting.
  useEffect(() => () => setGamePhase(null), []);
}
