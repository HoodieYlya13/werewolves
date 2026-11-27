import { siblingsCall } from "../siblings/steps";
import type { RoleDefinition } from "../role-definition";

export const twoSisters: RoleDefinition = { id: "two-sisters", team: "village", max: 2, copies: 2, calls: [siblingsCall("two-sisters", 32)] };
