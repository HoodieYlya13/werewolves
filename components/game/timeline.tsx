"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { type GameEvent, type GameState } from "@/lib/engine";
import { unreachable } from "@/lib/exhaustive";

export function Timeline({ game, rolesHidden }: { game: GameState; rolesHidden: boolean }) {
  const { dict } = useI18n();
  if (game.events.length === 0) return null;
  // Every line gives roles away: say why it's empty rather than leave a blank card.
  if (rolesHidden) {
    return (
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {dict.game.timeline}
        </summary>
        <p className="mt-3 text-sm text-muted-foreground">{dict.game.timelineHidden}</p>
      </details>
    );
  }
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium tracking-wide text-muted-foreground uppercase">
        {dict.game.timeline}
      </summary>
      <ol className="secret-role mt-3 flex flex-col gap-1.5 text-sm">
        {[...game.events].reverse().map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
              {e.phase.kind === "night" ? dict.game.nightShort : dict.game.dayShort}
              {e.phase.number}
            </span>
            <span>
              <EventText game={game} event={e} />
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
function EventText({ game, event }: { game: GameState; event: GameEvent }) {
  const { dict } = useI18n();
  const t = dict.game.events;
  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? "?";
  switch (event.type) {
    case "thief-swap":
      return format(t["thief-swap"], { name: name(event.playerId), role: dict.roles[event.to].name });
    case "lovers":
      return format(t.lovers, { a: name(event.lovers[0]), b: name(event.lovers[1]) });
    case "seer":
      return format(t.seer, { target: name(event.targetId), role: dict.roles[event.role].name });
    case "wolves-target":
    case "witch-heal":
    case "witch-poison":
      return format(t[event.type], { target: name(event.targetId) });
    case "death":
      return format(t.death, { name: name(event.playerId), cause: dict.game.causes[event.cause] });
    case "mayor":
      return format(t.mayor, { name: name(event.playerId) });
    case "vote":
      return event.targetId ? format(t.vote, { target: name(event.targetId) }) : t.voteNobody;
    case "actor":
      return format(t.actor, { role: dict.roles[event.role].name });
    case "wolf-hound":
      return format(t["wolf-hound"], {
        name: name(event.playerId),
        side: dict.game.steps["wolf-hound"][event.side],
      });
    case "model":
      return format(t.model, { name: name(event.playerId), model: name(event.modelId) });
    case "turned-wolf":
      return format(t["turned-wolf"], { name: name(event.playerId) });
    case "protected":
    case "infected":
    case "big-bad-wolf":
    case "white-werewolf":
    case "raven":
      return format(t[event.type], { target: name(event.targetId) });
    case "fox":
      return format(t.fox, { target: name(event.centerId), result: event.hasWolf ? t.foxYes : t.foxNo });
    case "charmed":
      return format(t.charmed, { names: event.targetIds.map(name).join(", ") });
    case "elder-survived":
      return format(t["elder-survived"], { name: name(event.playerId) });
    case "powers-lost":
      return t["powers-lost"];
    case "idiot-revealed":
      return format(t["idiot-revealed"], { name: name(event.playerId) });
    case "servant":
      return format(t.servant, { name: name(event.playerId), role: dict.roles[event.role].name });
    case "scapegoat":
      return event.voterIds.length > 0
        ? format(t.scapegoat, { names: event.voterIds.map(name).join(", ") })
        : t.scapegoatNobody;
    case "second-vote":
      return t["second-vote"];
    default:
      return unreachable(event);
  }
}
