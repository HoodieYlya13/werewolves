import type { RoleDefinition } from "../role-definition";

// Survives being voted out once (see eliminate in the vote's steps).
export const villageIdiot: RoleDefinition = { id: "village-idiot", team: "village", max: 1 };
