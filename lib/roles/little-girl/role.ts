import type { RoleDefinition } from "../role-definition";

// Peeks during the wolves' turn in real life. If caught, the master simply
// picks her as the wolves' victim, so she needs no step of her own.
export const littleGirl: RoleDefinition = { id: "little-girl", team: "village", max: 1 };
