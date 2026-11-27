import { getAlive, getPlayer, log } from "../../engine/helpers";
import { EngineError } from "../../engine/types";
import { nightCall } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const witchSteps: StepModules<"witch"> = {
  witch: {
    resolve: (state, step, answer) => {
      const { heal, poisonId } = answer.expect("witch");
      const witch = getPlayer(state, step.playerId);
      if (heal) {
        if (!step.canHeal || !step.victimId) throw new EngineError("invalid-action", "The Witch can't heal now");
        witch.uses.heal = (witch.uses.heal ?? 1) - 1;
        state.night.healed = true;
        log(state, { type: "witch-heal", targetId: step.victimId });
      }
      if (poisonId !== null) {
        if (!step.canPoison) throw new EngineError("invalid-action", "The Witch has no poison left");
        const target = getAlive(state, poisonId);
        if (target.id === step.victimId) throw new EngineError("invalid-target", "The wolves' victim is already dying");
        witch.uses.poison = (witch.uses.poison ?? 1) - 1;
        state.night.poisonedId = target.id;
        log(state, { type: "witch-poison", targetId: target.id });
      }
    },
    sleeper: () => "witch",
    actors: (step) => [step.playerId],
    turn: (step, { ids, me }) => ({
      kind: "witch",
      victimId: step.victimId,
      canHeal: step.canHeal,
      hasHealingPotion: (me.uses.heal ?? 0) > 0,
      canPoison: step.canPoison,
      targets: ids((p) => p.id !== step.victimId),
    }),
    timeout: () => ({ type: "witch", heal: false, poisonId: null }),
    beats: nightCall("witch"),
  },
};
