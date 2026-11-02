import type { Metadata } from "next";
import { BackHome } from "@/components/back-home";
import { ClientOnly } from "@/components/client-only";
import { AddFriendLink } from "@/components/friends/add-friend-link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { privatePage } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).friends.addLinkTitle, ...privatePage };
}

export default async function AddFriendPage() {
  const dict = await getDictionary();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-10">
      <BackHome />
      <h1 className="font-display text-3xl font-bold tracking-wide">{dict.friends.addLinkTitle}</h1>
      <ClientOnly fallback={null}>
        {/* The code is read on the device (useParams), so the page prerenders like the room pages. */}
        <AddFriendLink />
      </ClientOnly>
    </main>
  );
}
