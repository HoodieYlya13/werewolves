"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Smartphone, Skull, ThumbsDown, ThumbsUp } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Reveal } from "@/components/host/reveal";
import { useRoomContext } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import { Say, Do, PickPlayers, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

/**
 * The Witch's turn, one question at a time, as the narrator asks it: the
 * victim shown, then the healing potion, then the poison (thumb up or down).
 * Both questions are asked even with a potion gone, so the village can't tell.
 */
function WitchStep({ game, step, act }: StepProps<"witch">) {
  const { dict } = useI18n();
  const t = dict.game.steps.witch;
  const [stage, setStage] = useState<"show" | "heal" | "poison" | "target">("show");
  const [heal, setHeal] = useState(false);
  // Her phone asks each question when it's asked here, not before.
  const { send, phonePlays } = useRoomContext();
  const ask = stage === "target" ? "poison" : stage;
  useEffect(() => send?.({ type: "master-stage", stage: ask }), [send, ask]);
  const phone = phonePlays?.actions[step.playerId];
  const asked = phonePlays?.asked[step.playerId];
  const fromPhone = (label: string, onValidate: () => void) => (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-moon/40 bg-moon/10 p-4">
      <p className="flex min-w-0 flex-1 items-center gap-2 font-semibold text-moon">
        <Smartphone aria-hidden className="size-4 shrink-0" />
        {format(t.fromPhone, { name: witch, answer: label })}
      </p>
      <Button type="button" className="h-10 px-4" onClick={onValidate}>
        {dict.lead.validate}
      </Button>
    </section>
  );
  const victim = step.victimId ? nameOf(game, step.victimId) : null;
  const witch = nameOf(game, step.playerId);
  const hasHealingPotion = (game.players.find((p) => p.id === step.playerId)?.uses.heal ?? 0) > 0;
  const potion = (on: boolean, Icon: typeof FlaskConical, available: string, used: string, color: string) => (
    <li className={`flex items-center justify-center gap-3 ${on ? color : "text-muted-foreground line-through"}`}>
      <Icon aria-hidden className="size-8" />
      {on ? available : used}
    </li>
  );
  const answer = (yes: { label: string; onClick: () => void; disabled?: boolean }, no: () => void) => (
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <Button type="button" className="h-auto min-h-12 px-6 text-base whitespace-normal" disabled={yes.disabled} onClick={yes.onClick}>
        <ThumbsUp aria-hidden className="size-5" />
        {yes.label}
      </Button>
      <Button type="button" variant="outline" className="h-auto min-h-12 px-6 text-base" onClick={no}>
        <ThumbsDown aria-hidden className="size-5" />
        {dict.auto.no}
      </Button>
    </div>
  );

  if (stage === "show") {
    return (
      <>
        <Say>{t.wake}</Say>
        <Do>{format(t.do, { name: witch })}</Do>
        <Reveal to={witch} closeLabel={dict.game.continue} onClose={() => setStage("heal")}>
          <p className="font-display text-5xl font-bold text-balance wrap-anywhere sm:text-7xl">{victim ?? t.noVictim}</p>
          <ul className="flex flex-col gap-3 text-2xl font-semibold sm:text-3xl">
            {potion(hasHealingPotion, FlaskConical, t.healAvailable, t.healUsed, "text-ok")}
            {potion(step.canPoison, Skull, t.poisonAvailable, t.poisonUsed, "text-primary")}
          </ul>
        </Reveal>
      </>
    );
  }
  if (stage === "heal") {
    return (
      <>
        {phone?.type === "witch" &&
          asked &&
          fromPhone(phone.heal ? dict.auto.yes : dict.auto.no, () => {
            setHeal(phone.heal);
            setStage("poison");
          })}
        <Say>{t.askHeal}</Say>
        <Do>{step.canHeal ? format(t.thumbs, { name: witch }) : hasHealingPotion ? t.nobodyToHeal : t.used}</Do>
        {answer(
          {
            label: victim && step.canHeal ? format(t.heal, { name: victim }) : dict.auto.yes,
            disabled: !step.canHeal,
            onClick: () => {
              setHeal(true);
              setStage("poison");
            },
          },
          () => {
            setHeal(false);
            setStage("poison");
          },
        )}
      </>
    );
  }
  if (stage === "poison") {
    return (
      <>
        {phone?.type === "witch" &&
          asked === "poison" &&
          fromPhone(phone.poisonId ? nameOf(game, phone.poisonId) : dict.auto.no, () => act({ type: "witch", heal, poisonId: phone.poisonId }))}
        <Say>{t.askPoison}</Say>
        <Do>{step.canPoison ? format(t.thumbs, { name: witch }) : t.used}</Do>
        {answer({ label: dict.auto.yes, disabled: !step.canPoison, onClick: () => setStage("target") }, () =>
          act({ type: "witch", heal, poisonId: null }),
        )}
      </>
    );
  }
  return (
    <>
      <Do>{format(t.pickPoison, { name: witch })}</Do>
      <PickPlayers
        game={game}
        count={1}
        // Already dying: the poison would only tell the village who used it.
        isDisabled={(p) => p.id === step.victimId}
        onConfirm={([poisonId]) => act({ type: "witch", heal, poisonId: poisonId ?? null })}
        extra={
          <Button type="button" variant="outline" className="h-12" onClick={() => setStage("poison")}>
            {dict.ballot.back}
          </Button>
        }
      />
    </>
  );
}

export const witchScreens: StepScreens<"witch"> = {
  witch: {
    describe: (game, step, action, dict) => {
      if (action.type !== "witch") return "";
      const t = dict.game.steps.witch;
      const parts = [];
      if (action.heal && step.victimId) parts.push(format(t.heal, { name: nameOf(game, step.victimId) }));
      if (action.poisonId) parts.push(`${t.poison}: ${nameOf(game, action.poisonId)}`);
      return parts.join(" · ") || t.nothing;
    },
    Screen: WitchStep,
  },
};
