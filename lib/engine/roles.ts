import { roleDefinitions, type RoleDefinition } from "../roles";
import { tableCalls, type Call } from "../steps";
import { bluff } from "./bluff";
import { holders } from "./helpers";
import type { PhaseRef, RoleId } from "./types";

export type { RoleDefinition, NightTurn } from "../roles";

export const roles = roleDefinitions;

export const roleIds = Object.keys(roles) as RoleId[];

/** Powers the Actor can borrow: one-night powers with a step of their own. */
export const actorRoles = roleIds.filter((r) => roles[r].actorCanBorrow);

/** A role's own night turn, and the Actor's turn with that power right after, on a night they borrow it. */
function ownTurns(id: RoleId, definition: RoleDefinition): Call[] {
  const night = definition.night;
  if (!night) return [];
  const isBluffed = night.isBluffed ?? (() => true);
  const own: Call = {
    id,
    phase: "night",
    order: night.order,
    firstNightOnly: night.firstNightOnly,
    evenNightsOnly: night.evenNightsOnly,
    build: (state) => {
      const holder = holders(state, id)[0];
      const step = holder ? night.act(state, holder) : null;
      return step ?? (isBluffed(state) ? bluff(state, id, id) : null);
    },
  };
  if (!definition.actorCanBorrow) return [own];
  const borrowed: Call = {
    id: `actor:${id}`,
    phase: "night",
    order: night.order + 0.5,
    build: (state) => {
      if (state.night.actorRole !== id) return null;
      const actor = holders(state, "actor")[0];
      return actor ? night.act(state, actor) : null;
    },
  };
  return [own, borrowed];
}

const sequences = new Map<PhaseRef["kind"], Call[]>();

/** Every call of a night or a day, in order: the roles' turns and calls, then the table's. */
export function callsOf(phase: PhaseRef["kind"]): Call[] {
  let calls = sequences.get(phase);
  if (!calls) {
    const roleCalls = roleIds.flatMap((id) => [...ownTurns(id, roles[id]), ...(roles[id].calls ?? [])]);
    calls = [...roleCalls, ...tableCalls].filter((call) => call.phase === phase).sort((a, b) => a.order - b.order);
    sequences.set(phase, calls);
  }
  return calls;
}
