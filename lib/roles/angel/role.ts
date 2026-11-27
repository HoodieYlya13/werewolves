import type { RoleDefinition } from "../role-definition";

// Wins alone if eliminated in the first turn (see win.ts). The game then
// opens with a day 0 vote, before night 1.
export const angel: RoleDefinition = { id: "angel", team: "village", max: 1 };
