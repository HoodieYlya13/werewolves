import type { RoleDefinition } from "../role-definition";

// Offered the voted-out player's role (see kill() in the engine's deaths).
export const devotedServant: RoleDefinition = { id: "devoted-servant", team: "village", max: 1 };
