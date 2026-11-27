import { siblingsCall } from "../siblings/steps";
import type { RoleDefinition } from "../role-definition";

export const threeBrothers: RoleDefinition = { id: "three-brothers", team: "village", max: 3, copies: 3, calls: [siblingsCall("three-brothers", 34)] };
