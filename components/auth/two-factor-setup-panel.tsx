"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TwoFactorSetupPanelProps = {
  nextPath: string;
  title?: string;
  description?: string;
};

function normalizeNextPath(nextPath: string) {
  if (!nextPath.startsWith("/")) return "/dashboard/control-plane";
  return nextPath;
}

export function TwoFactorSetupPanel({
  nextPath,
  title = "Two-Factor Authentication",
  description = "Set up TOTP using an authenticator app and verify once to enable 2FA.",
}: TwoFactorSetupPanelProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const safeNextPath = useMemo(() => normalizeNextPath(nextPath), [nextPath]);

  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const userWithTwoFactor = session?.user as { twoFactorEnabled?: boolean } | undefined;
  const isTwoFactorEnabled = Boolean(userWithTwoFactor?.twoFactorEnabled);

  const resolveError = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: string }).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }

    return fallback;
  };

  const enableTwoFactor = async () => {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await authClient.twoFactor.enable({
        password: password.trim() || undefined,
        issuer: "Fortmont Cloud and IAM",
      });

      if (result.error) {
        setErrorMessage(result.error.message ?? "Failed to initialize 2FA setup.");
        return;
      }

      setTotpUri(result.data?.totpURI ?? "");
      setBackupCodes(result.data?.backupCodes ?? []);
      setStatusMessage("QR code generated. Scan it and verify with a 6-digit code.");
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to initialize 2FA setup."));
    } finally {
      setIsBusy(false);
    }
  };

  const verifyTotp = async () => {
    if (!verificationCode.trim()) {
      setErrorMessage("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: verificationCode.trim(),
        trustDevice: true,
      });

      if (result.error) {
        setErrorMessage(result.error.message ?? "Invalid verification code.");
        return;
      }

      setStatusMessage("Two-factor authentication is now enabled.");
      router.push(safeNextPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to verify the TOTP code."));
    } finally {
      setIsBusy(false);
    }
  };

  const disableTwoFactor = async () => {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await authClient.twoFactor.disable({
        password: password.trim() || undefined,
      });

      if (result.error) {
        setErrorMessage(result.error.message ?? "Failed to disable 2FA.");
        return;
      }

      setTotpUri("");
      setBackupCodes([]);
      setVerificationCode("");
      setStatusMessage("Two-factor authentication has been disabled.");
      router.refresh();
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to disable 2FA."));
    } finally {
      setIsBusy(false);
    }
  };

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading session...</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="two-factor-password">Account password</Label>
        <Input
          id="two-factor-password"
          type="password"
          autoComplete="current-password"
          placeholder="Required for credential accounts"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {!isTwoFactorEnabled && !totpUri ? (
        <Button type="button" onClick={() => void enableTwoFactor()} disabled={isBusy}>
          {isBusy ? "Generating..." : "Generate QR code"}
        </Button>
      ) : null}

      {!isTwoFactorEnabled && totpUri ? (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="mx-auto w-fit rounded-lg bg-white p-3">
            <QRCode value={totpUri} size={180} />
          </div>
          <p className="break-all text-xs text-muted-foreground">{totpUri}</p>

          <div className="space-y-2">
            <Label htmlFor="two-factor-code">Verification code</Label>
            <Input
              id="two-factor-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\s+/g, ""))}
            />
          </div>

          <Button type="button" onClick={() => void verifyTotp()} disabled={isBusy}>
            {isBusy ? "Verifying..." : "Verify and enable"}
          </Button>

          {backupCodes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Backup codes</p>
              <p className="text-xs text-muted-foreground">
                Save these in a secure place. Each code can be used once.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code) => (
                  <div key={code} className="rounded border px-2 py-1 font-mono text-xs">
                    {code}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {isTwoFactorEnabled ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="text-sm text-emerald-600">2FA is currently enabled for this account.</p>
          <Button type="button" variant="destructive" onClick={() => void disableTwoFactor()} disabled={isBusy}>
            {isBusy ? "Disabling..." : "Disable 2FA"}
          </Button>
        </div>
      ) : null}

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      {statusMessage ? <p className="text-sm text-emerald-600">{statusMessage}</p> : null}

      <Button type="button" variant="outline" onClick={() => router.push(safeNextPath)}>
        Return
      </Button>
    </div>
  );
}
