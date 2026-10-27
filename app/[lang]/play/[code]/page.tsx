import { ClientOnly } from "@/components/client-only";
import { ConnectionBanner } from "@/components/room-status";
import { PlayerRoom } from "@/components/play/player-room";

export default function PlayPage() {
  return (
    // The prerendered shell shows "Connecting…" until the room loads on the device.
    <ClientOnly fallback={<ConnectionBanner status="connecting" />}>
      <PlayerRoom />
    </ClientOnly>
  );
}
