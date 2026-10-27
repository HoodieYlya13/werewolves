import { ClientOnly } from "@/components/client-only";
import { ConnectionBanner } from "@/components/room-status";
import { HostRoom } from "@/components/host/host-room";

export default function HostPage() {
  return (
    // The prerendered shell shows "Connecting…" until the room loads on the device.
    <ClientOnly fallback={<ConnectionBanner status="connecting" />}>
      <HostRoom />
    </ClientOnly>
  );
}
