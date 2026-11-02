import type { Metadata } from "next";
import { BackHome } from "@/components/back-home";
import { ClientOnly } from "@/components/client-only";
import { PlayerProfile } from "@/components/player-profile";
import { StatsSkeleton } from "@/components/skeletons";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { privatePage } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  // Public, but not for search engines: a profile is for the people who play together.
  return { title: (await getDictionary()).profile.title, ...privatePage };
}

export default function PlayerPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-10 sm:px-6">
      <BackHome />
      {/* The code is read on the device (useParams), so the page prerenders like the room pages. */}
      <ClientOnly fallback={<StatsSkeleton />}>
        <PlayerProfile />
      </ClientOnly>
    </main>
  );
}
