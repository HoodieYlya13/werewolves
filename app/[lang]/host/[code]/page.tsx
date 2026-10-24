import { ClientOnly } from "@/components/client-only";
import { HostRoom } from "@/components/host/host-room";

export default function HostPage() {
  return (
    <ClientOnly>
      <HostRoom />
    </ClientOnly>
  );
}
