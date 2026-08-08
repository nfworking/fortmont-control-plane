"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";

type AppLoadingGateProps = {
  children: React.ReactNode;
};

const LOADING_DELAY_MS = 2000;

function AppSkeleton() {
  return (
    <div className="min-h-screen w-full bg-black text-zinc-100">
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-72 border-r border-zinc-900 bg-zinc-950/60 p-4 lg:block">
          <Skeleton className="mb-6 h-8 w-40 bg-zinc-800" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full bg-zinc-900" />
            ))}
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-zinc-900 px-4 lg:px-6">
            <Skeleton className="h-6 w-44 bg-zinc-800" />
            <Skeleton className="h-9 w-28 rounded-full bg-zinc-800" />
          </header>

          <main className="flex-1 space-y-6 p-4 lg:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full bg-zinc-900" />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Skeleton className="h-80 w-full xl:col-span-2 bg-zinc-900" />
              <Skeleton className="h-80 w-full bg-zinc-900" />
            </div>

            <Skeleton className="h-56 w-full bg-zinc-900" />
          </main>
        </div>
      </div>
    </div>
  );
}

export function AppLoadingGate({ children }: AppLoadingGateProps) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    // Enforce a small delay to keep page transitions feeling intentional.
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, LOADING_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="relative min-h-screen w-full">
        <div className="invisible">{children}</div>
        <div className="absolute inset-0 z-50">
          <AppSkeleton />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
