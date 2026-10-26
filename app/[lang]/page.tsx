import { Crown, Smartphone } from "lucide-react";
import { CreateRoomButton } from "@/components/home/create-room-button";
import { JoinForm } from "@/components/home/join-form";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function HomePage() {
  const dict = await getDictionary();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-4 py-10 sm:px-6">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-wide sm:text-6xl">{dict.app.name}</h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-muted">{dict.app.tagline}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card flex flex-col gap-4 p-6">
          <Crown aria-hidden className="size-7 text-moon" />
          <div>
            <h2 className="text-xl font-semibold">{dict.home.hostTitle}</h2>
            <p className="mt-1 text-sm text-muted">{dict.home.hostDescription}</p>
          </div>
          <CreateRoomButton />
        </section>

        <section className="card flex flex-col gap-4 p-6">
          <Smartphone aria-hidden className="size-7 text-moon" />
          <div>
            <h2 className="text-xl font-semibold">{dict.home.joinTitle}</h2>
            <p className="mt-1 text-sm text-muted">{dict.home.joinDescription}</p>
          </div>
          <JoinForm />
        </section>
      </div>
    </main>
  );
}
