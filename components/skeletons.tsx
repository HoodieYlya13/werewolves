"use client";

import { useI18n } from "@/components/i18n-provider";

/** A grey block that pulses where content is about to appear. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-surface-2 ${className}`} />;
}

/** Says what the skeleton stands for, to screen readers only. */
function Loading({ room = false }: { room?: boolean }) {
  const { dict } = useI18n();
  return (
    <p role="status" className="sr-only">
      {room ? dict.connection.connecting : dict.connection.loading}
    </p>
  );
}

/**
 * The game master's screen until the room answers: the shape of the lobby,
 * so nothing shows a state the room isn't in (an empty lobby, a missing game).
 */
export function HostRoomSkeleton() {
  return (
    <main
      aria-busy
      className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <Loading room />
      <section className="card flex flex-col items-center gap-4 p-6 lg:self-start">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-56" />
        <Skeleton className="size-54 sm:size-62" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-full" />
      </section>
      <section className="card flex flex-col gap-4 p-4 sm:p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64 max-w-full" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </section>
    </main>
  );
}

/** A phone until it knows the room and who is signed in: no form that might be the wrong one. */
export function PhoneSkeleton({ code }: { code?: string }) {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <Loading room />
      {code === undefined && <Skeleton className="mx-auto h-4 w-20" />}
      <section className="card flex flex-col items-center gap-3 p-6">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
      </section>
      <section className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </section>
    </div>
  );
}

/** The phone page before it runs on the device. */
export function PhonePageSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-10">
      <PhoneSkeleton />
    </main>
  );
}

/** The stats page while the account and its games load. */
export function StatsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <Loading />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-56" />
    </div>
  );
}
