import { ClientOnly } from "@/components/client-only";
import { privatePage } from "@/lib/seo";
import { PhonePageSkeleton } from "@/components/skeletons";
import { PlayerRoom } from "@/components/play/player-room";

// A room only makes sense to the people in it.
export const metadata = privatePage;

export default function PlayPage() {
  return (
    // The prerendered shell shows the screen's outline until the room loads on the device.
    <ClientOnly fallback={<PhonePageSkeleton />}>
      <PlayerRoom />
    </ClientOnly>
  );
}
