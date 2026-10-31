import { ClientOnly } from "@/components/client-only";
import { privatePage } from "@/lib/seo";
import { HostRoomSkeleton } from "@/components/skeletons";
import { HostRoom } from "@/components/host/host-room";

// A room only makes sense to the people in it.
export const metadata = privatePage;

export default function HostPage() {
  return (
    // The prerendered shell shows the screen's outline until the room loads on the device.
    <ClientOnly fallback={<HostRoomSkeleton />}>
      <HostRoom />
    </ClientOnly>
  );
}
