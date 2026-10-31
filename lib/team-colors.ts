import type { Team } from "@/lib/engine";

/** Team colour used for role names, chips and card stripes. */
export const teamColor: Record<Team, string> = {
  village: "text-moon",
  wolves: "text-primary",
  lovers: "text-pink-500",
  piper: "text-emerald-500",
  "white-werewolf": "text-violet-500",
  sectarian: "text-orange-500",
  angel: "text-sky-500",
};
