import type { Metadata } from "next";
import { BackHome } from "@/components/back-home";
import { ClientOnly } from "@/components/client-only";
import { FriendsView } from "@/components/friends/friends-view";
import { StatsSkeleton } from "@/components/skeletons";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { privatePage } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).friends.title, ...privatePage };
}

export default async function FriendsPage() {
  const dict = await getDictionary();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-10 sm:px-6">
      <BackHome />
      <h1 className="font-display text-3xl font-bold tracking-wide">{dict.friends.title}</h1>
      {/* The account is only known on the device. */}
      <ClientOnly fallback={<StatsSkeleton />}>
        <FriendsView />
      </ClientOnly>
    </main>
  );
}
