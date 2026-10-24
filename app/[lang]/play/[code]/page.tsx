import { ClientOnly } from "@/components/client-only";
import { PlayerRoom } from "@/components/play/player-room";

export default function PlayPage() {
  return (
    <ClientOnly>
      <PlayerRoom />
    </ClientOnly>
  );
}
