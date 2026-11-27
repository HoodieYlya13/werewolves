"use client";

import { useState } from "react";
import { FlaskConical, Skull, ThumbsDown, ThumbsUp } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useName } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { PickList } from "@/components/game/pick-list";
import { OptionButton, PlayButton, play, toggle, type PhoneTurnProps, type PhoneTurnScreens } from "@/components/phone/turn-parts";
import { format } from "@/lib/i18n/config";

/** The Witch's potions, one question at a time. */
function WitchTurn({ turn, send }: PhoneTurnProps<"witch">) {
  const onConfirm = (heal: boolean, poisonId: string | null) => play(send)({ type: "witch", heal, poisonId });
  const { dict } = useI18n();
  const name = useName();
  const t = dict.game.steps.witch;
  // One question at a time: the healing potion, then the poison. With a game master,
  // each when they ask it (`turn.ask`); without, one after the other.
  const [mine, setMine] = useState<"heal" | "poison" | "target">("heal");
  const [heal, setHeal] = useState(false);
  const [poison, setPoison] = useState<string[]>([]);
  const led = turn.ask !== undefined;
  const healed = led ? (turn.healed ?? false) : heal;
  const stage = !led ? mine : turn.ask === "poison" ? (mine === "target" ? "target" : "poison") : turn.ask === "heal" && turn.healed != null ? "answered" : turn.ask;
  const victim = turn.victimId ? name(turn.victimId) : null;
  // Each answer is picked, then confirmed: a slip of the thumb doesn't waste a potion.
  const [choice, setChoice] = useState<{ stage: string; yes: boolean } | null>(null);
  const asking = `${stage}`;
  const picked = choice && choice.stage === asking ? choice.yes : null;
  const answer = (onYes: () => void, onNo: () => void) => (
    <>
      <div className="grid grid-cols-2 gap-2">
        <OptionButton on={picked === true} onClick={() => setChoice({ stage: asking, yes: true })}>
          <ThumbsUp aria-hidden className="size-5" />
          {dict.auto.yes}
        </OptionButton>
        <OptionButton on={picked === false} onClick={() => setChoice({ stage: asking, yes: false })}>
          <ThumbsDown aria-hidden className="size-5" />
          {dict.auto.no}
        </OptionButton>
      </div>
      <PlayButton
        ready={picked !== null}
        onClick={() => {
          setChoice(null);
          (picked ? onYes : onNo)();
        }}
      />
    </>
  );
  const back = (to: "heal" | "poison") =>
    (!led || to === "poison") && (
      <Button type="button" variant="ghost" className="h-10" onClick={() => setMine(to)}>
        {dict.ballot.back}
      </Button>
    );
  const shown = <p className="text-2xl font-semibold wrap-anywhere">{victim ? format(t.victim, { name: victim }) : t.noVictim}</p>;

  if (stage === "show") {
    return (
      <>
        {shown}
        <p className="text-muted-foreground">{t.wait}</p>
      </>
    );
  }
  if (stage === "answered") {
    return (
      <>
        {shown}
        <p className="text-muted-foreground">{format(t.answered, { answer: turn.healed ? dict.auto.yes : dict.auto.no })}</p>
      </>
    );
  }
  if (stage === "heal") {
    // With a game master, the answer goes to them now; without, it waits for the poison's.
    const answerHeal = (yes: boolean) => {
      if (led) return onConfirm(yes, null);
      setHeal(yes);
      setMine("poison");
    };
    return (
      <>
        {shown}
        {victim && turn.canHeal ? (
          <>
            <p className="flex items-center gap-2 font-medium">
              <FlaskConical aria-hidden className="size-5 shrink-0 text-ok" />
              {t.askHeal}
            </p>
            {answer(() => answerHeal(true), () => answerHeal(false))}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">{!turn.hasHealingPotion ? t.cantHeal : victim ? t.cantHealSelf : t.noVictim}</p>
            <PlayButton ready label={dict.game.continue} onClick={() => answerHeal(false)} />
          </>
        )}
      </>
    );
  }
  if (stage === "poison") {
    return (
      <>
        {healed && victim && <p className="font-medium text-ok wrap-anywhere">{format(t.heal, { name: victim })}</p>}
        {turn.canPoison ? (
          <>
            <p className="flex items-center gap-2 font-medium">
              <Skull aria-hidden className="size-5 shrink-0 text-primary" />
              {t.askPoison}
            </p>
            {answer(() => setMine("target"), () => onConfirm(healed, null))}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">{t.cantPoison}</p>
            <PlayButton ready onClick={() => onConfirm(healed, null)} />
          </>
        )}
        {back("heal")}
      </>
    );
  }
  return (
    <>
      <p className="flex items-center gap-2 font-medium">
        <Skull aria-hidden className="size-5 shrink-0 text-primary" />
        {t.poison}
      </p>
      <PickList targets={turn.targets} selected={poison} onToggle={(id) => setPoison((s) => toggle(s, id, 1))} />
      <PlayButton ready={poison.length > 0} onClick={() => onConfirm(healed, poison[0])} />
      {back("poison")}
    </>
  );
}

export const witchPhoneTurns: PhoneTurnScreens<"witch"> = {
  witch: { Screen: WitchTurn, title: (dict) => dict.roles.witch.name },
};
