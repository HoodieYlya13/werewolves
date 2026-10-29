import { ClientOnly } from "@/components/client-only";
import { HostRoomSkeleton } from "@/components/skeletons";
import { HostRoom } from "@/components/host/host-room";

export default function HostPage() {
  return (
    // The prerendered shell shows the screen's outline until the room loads on the device.
    <ClientOnly fallback={<HostRoomSkeleton />}>
      <HostRoom />
    </ClientOnly>
  );
}
