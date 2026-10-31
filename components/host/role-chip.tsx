"use client";

import { useI18n } from "@/components/i18n-provider";
import { roles, type RoleId } from "@/lib/engine";
import { teamColor } from "@/lib/team-colors";

export { teamColor };

/** `secret` roles blur when the game master turns on "Hide roles". */
export function RoleName({ role, className = "", secret = false }: { role: RoleId; className?: string; secret?: boolean }) {
  const { dict } = useI18n();
  return (
    <span className={`${teamColor[roles[role].team]} ${secret ? "secret-role" : ""} ${className}`}>
      {dict.roles[role].name}
    </span>
  );
}
