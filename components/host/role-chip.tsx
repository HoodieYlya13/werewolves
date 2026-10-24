"use client";

import { useI18n } from "@/components/i18n-provider";
import { roles, type RoleId, type Team } from "@/lib/engine";

/** Team colour used for role names, chips and card stripes. */
export const teamColor: Record<Team, string> = {
  village: "text-moon",
  wolves: "text-accent",
  lovers: "text-pink-500",
};

/** `secret` roles blur when the game master turns on "Hide roles". */
export function RoleName({ role, className = "", secret = false }: { role: RoleId; className?: string; secret?: boolean }) {
  const { dict } = useI18n();
  return (
    <span className={`${teamColor[roles[role].team]} ${secret ? "secret-role" : ""} ${className}`}>
      {dict.roles[role].name}
    </span>
  );
}
