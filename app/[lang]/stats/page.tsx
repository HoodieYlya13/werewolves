import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { StatsView } from "@/components/stats-view";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).stats.title };
}

export default async function StatsPage() {
  const dict = await getDictionary();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-wide">{dict.stats.title}</h1>
      {/* The account is only known on the device. */}
      <ClientOnly>
        <StatsView />
      </ClientOnly>
    </main>
  );
}
