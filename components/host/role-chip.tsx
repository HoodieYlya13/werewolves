"use client";

import { useI18n } from "@/components/i18n-provider";
import { roles, type RoleId, type Team } from "@/lib/engine";

/** Team colour used for role names, chips and card stripes. */
export const teamColor: Record<Team, string> = {
  village: "text-moon",
  wolves: "text-accent",
  lovers: "text-pink-500",
};

export function RoleName({ role, className = "" }: { role: RoleId; className?: string }) {
  const { dict } = useI18n();
  return <span className={`${teamColor[roles[role].team]} ${className}`}>{dict.roles[role].name}</span>;
}
