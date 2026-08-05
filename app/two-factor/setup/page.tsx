"use client";

import { useSearchParams } from "next/navigation";

import { GridBackground } from "@/components/ui/grid-bg";
import { TwoFactorSetupPanel } from "@/components/auth/two-factor-setup-panel";

export default function TwoFactorSetupPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard/control-plane";

  return (
    <GridBackground>
      <div className="mx-auto flex min-h-svh w-full max-w-2xl items-center justify-center p-6 md:p-10">
        <div className="w-full rounded-2xl border bg-background/95 p-6 shadow-sm">
          <TwoFactorSetupPanel
            nextPath={nextPath}
            title="Set up Two-Factor Authentication"
            description="Scan the QR code with your authenticator app, then verify the code to complete setup."
          />
        </div>
      </div>
    </GridBackground>
  );
}
