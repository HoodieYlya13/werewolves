import { ClientOnly } from "@/components/client-only";
import { PhonePageSkeleton } from "@/components/skeletons";
import { PlayerRoom } from "@/components/play/player-room";

export default function PlayPage() {
  return (
    // The prerendered shell shows the screen's outline until the room loads on the device.
    <ClientOnly fallback={<PhonePageSkeleton />}>
      <PlayerRoom />
    </ClientOnly>
  );
}
