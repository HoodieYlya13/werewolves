"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Avatar, useName } from "@/components/room-context";
import { RoleName } from "@/components/game/role-chip";
import { PickList } from "@/components/game/pick-list";
import { OptionButton, PlayButton, play, toggle, type PhoneTurnProps, type PhoneTurnScreens } from "@/components/phone/turn-parts";
import { pickAction } from "@/lib/auto";
import { format } from "@/lib/i18n/config";

function PickTurn({ turn, send }: PhoneTurnProps<"pick">) {
  const onConfirm = (ids: string[]) => play(send)(pickAction(turn, ids));
  const { dict } = useI18n();
  const name = useName();
  const [selected, setSelected] = useState<string[]>([]);
  const [nobody, setNobody] = useState(false);
  const skipLabel = (dict.game.steps as Record<string, { skip?: string }>)[turn.step]?.skip;
  const valid = selected.length >= turn.min && selected.length <= turn.max;
  return (
    <>
      {turn.lastId && <p className="text-sm text-muted-foreground">{format(dict.auto.lastProtected, { name: name(turn.lastId) })}</p>}
      <PickList
        targets={turn.targets}
        selected={selected}
        onToggle={(id) => {
          setNobody(false);
          setSelected((s) => toggle(s, id, turn.max));
        }}
      />
      {turn.skip && (
        <OptionButton
          on={nobody}
          onClick={() => {
            setNobody(!nobody);
            setSelected([]);
          }}
        >
          {skipLabel ?? dict.auto.no}
        </OptionButton>
      )}
      <PlayButton ready={nobody || valid} onClick={() => onConfirm(nobody ? [] : selected)} />
    </>
  );
}

function CardsTurn({ turn, send }: PhoneTurnProps<"cards">) {
  const onConfirm = (pick: number | null) => play(send)(turn.step === "thief" ? { type: "thief", pick } : { type: "choose", value: pick });
  const { dict } = useI18n();
  const t = dict.auto;
  // undefined: nothing picked yet; null: keeping one's card (or no power).
  const [pick, setPick] = useState<number | null | undefined>(undefined);
  return (
    <>
      <p className="text-muted-foreground">{turn.step === "thief" ? t.thiefHint : t.actorHint}</p>
      <div className={`grid gap-3 ${turn.cards.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {turn.cards.map((role, i) => (
          <OptionButton key={i} on={pick === i} onClick={() => setPick(i)} className="aspect-[3/4] p-3 text-lg">
            <RoleName role={role} />
          </OptionButton>
        ))}
      </div>
      {turn.canKeep && (
        <OptionButton on={pick === null} onClick={() => setPick(null)}>
          {turn.step === "thief" ? t.keep : t.noPower}
        </OptionButton>
      )}
      <PlayButton ready={pick !== undefined} onClick={() => onConfirm(pick ?? null)} />
    </>
  );
}

function ChoiceTurn({ turn, send }: PhoneTurnProps<"choice">) {
  const onConfirm = (value: string | boolean) => play(send)({ type: "choose", value });
  const { dict } = useI18n();
  const name = useName();
  const t = dict.auto;
  const steps = dict.game.steps;
  const [value, setValue] = useState<string | boolean | null>(null);
  const [question, options]: [string, { label: string; value: string | boolean }[]] =
    turn.step === "wolf-hound"
      ? [steps["wolf-hound"].say, [{ label: steps["wolf-hound"].village, value: "village" }, { label: steps["wolf-hound"].wolves, value: "wolves" }]]
      : [
          turn.step === "infect" ? format(t.infect, { name: name(turn.victimId!) }) : turn.step === "servant" ? format(t.servantChoice, { name: name(turn.victimId!) }) : t.judge,
          [
            { label: t.yes, value: true },
            { label: t.no, value: false },
          ],
        ];
  return (
    <>
      <p className="text-xl font-semibold">{question}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <OptionButton key={String(o.value)} on={value === o.value} onClick={() => setValue(o.value)} className="min-h-14 text-base">
            {o.label}
          </OptionButton>
        ))}
      </div>
      <PlayButton ready={value !== null} onClick={() => onConfirm(value!)} />
    </>
  );
}

/** News for this player alone: a lover, a charm, an infection… */
function CheckTurn({ turn }: PhoneTurnProps<"check">) {
  const { dict } = useI18n();
  const name = useName();
  const t = dict.auto;
  return (
    <p className="text-center text-2xl font-semibold text-balance">
      {turn.message === "lover" ? format(t.check.lover, { name: name(turn.partnerId!) }) : t.check[turn.message]}
    </p>
  );
}

/** Who wakes up together: the lovers, the charmed, the siblings. */
function GroupTurn({ turn }: PhoneTurnProps<"group">) {
  const { dict } = useI18n();
  const name = useName();
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xl font-semibold">{dict.auto.group[turn.group]}</p>
      <ul className="flex flex-wrap justify-center gap-3">
        {turn.ids.map((id) => (
          <li key={id} className="flex flex-col items-center gap-1">
            <Avatar playerId={id} name={name(id)} className="size-16 text-xl" />
            <span className="max-w-24 text-center font-medium wrap-anywhere">{name(id)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The turns several roles share. */
export const sharedPhoneTurns: PhoneTurnScreens<"pick" | "cards" | "choice" | "check" | "group"> = {
  pick: { Screen: PickTurn, title: (dict, turn) => dict.auto.turn[turn.step] },
  cards: { Screen: CardsTurn },
  choice: { Screen: ChoiceTurn },
  check: { Screen: CheckTurn, isSecret: true },
  group: { Screen: GroupTurn, isSecret: true },
};
