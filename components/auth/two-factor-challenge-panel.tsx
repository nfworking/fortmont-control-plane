"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TwoFactorChallengePanelProps = {
  nextPath: string;
};

type ChallengeMode = "totp" | "backup";

function normalizeNextPath(nextPath: string) {
  if (!nextPath.startsWith("/")) return "/dashboard/control-plane";
  return nextPath;
}

export function TwoFactorChallengePanel({ nextPath }: TwoFactorChallengePanelProps) {
  const router = useRouter();
  const safeNextPath = useMemo(() => normalizeNextPath(nextPath), [nextPath]);

  const [mode, setMode] = useState<ChallengeMode>("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const verify = async () => {
    if (!code.trim()) {
      toast.warning(mode === "totp" ? "Enter your authenticator code." : "Enter a backup code.");
      return;
    }

    setIsBusy(true);

    try {
      if (mode === "totp") {
        const result = await authClient.twoFactor.verifyTotp({
          code: code.trim(),
          trustDevice,
        });

        if (result.error) {
          toast.error(result.error.message ?? "Invalid verification code.");
          return;
        }
      } else {
        const result = await authClient.twoFactor.verifyBackupCode({
          code: code.trim(),
          trustDevice,
        });

        if (result.error) {
          toast.error(result.error.message ?? "Invalid backup code.");
          return;
        }
      }

      toast.success("Signed in successfully.");
      router.push(safeNextPath);
      router.refresh();
    } catch {
      toast.error("Could not verify the second factor. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Two-factor verification</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your authenticator code or a backup code to complete sign in.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={mode === "totp" ? "default" : "outline"}
          onClick={() => setMode("totp")}
          className="w-full"
        >
          Authenticator
        </Button>
        <Button
          type="button"
          variant={mode === "backup" ? "default" : "outline"}
          onClick={() => setMode("backup")}
          className="w-full"
        >
          Backup code
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="two-factor-challenge-code">
          {mode === "totp" ? "Authenticator code" : "Backup code"}
        </Label>
        <Input
          id="two-factor-challenge-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\s+/g, ""))}
          inputMode={mode === "totp" ? "numeric" : "text"}
          maxLength={mode === "totp" ? 6 : undefined}
          placeholder={mode === "totp" ? "123456" : "backup-code"}
        />
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(event) => setTrustDevice(event.target.checked)}
        />
        Trust this device for 30 days
      </label>

      <Button type="button" className="mt-4 w-full" onClick={() => void verify()} disabled={isBusy}>
        {isBusy ? "Verifying..." : "Verify"}
      </Button>
    </div>
  );
}
