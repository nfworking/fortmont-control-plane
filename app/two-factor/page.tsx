"use client";

import { useSearchParams } from "next/navigation";

import { GridBackground } from "@/components/ui/grid-bg";
import { TwoFactorChallengePanel } from "@/components/auth/two-factor-challenge-panel";

export default function TwoFactorPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard/control-plane";

  return (
    <GridBackground>
      <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
        <TwoFactorChallengePanel nextPath={nextPath} />
      </div>
    </GridBackground>
  );
}
