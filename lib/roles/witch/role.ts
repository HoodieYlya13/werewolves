import type { RoleDefinition } from "../role-definition";

export const witch: RoleDefinition = {
  id: "witch",
  team: "village",
  max: 1,
  uses: { heal: 1, poison: 1 },
  actorCanBorrow: true,
  night: {
    order: 60,
    act: (state, witch) => {
      // An infected victim doesn't die, so there's nothing to heal.
      const victimId = state.night.infected ? null : state.night.wolvesTargetId;
      const canHeal =
        (witch.uses.heal ?? 0) > 0 &&
        victimId !== null &&
        (victimId !== witch.id || state.setup.settings.witchCanSelfHeal);
      const canPoison = (witch.uses.poison ?? 0) > 0;
      // Called every night, potions or not: skipping her would tell the village they're gone.
      return { kind: "witch", playerId: witch.id, victimId, canHeal, canPoison };
    },
  },
};
