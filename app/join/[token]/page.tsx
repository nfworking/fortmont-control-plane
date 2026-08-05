"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

type JoinPayload = {
  organization?: {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
  };
  authRequired?: boolean;
  membership?: { id: string; role: string } | null;
  request?: { id: string; status: string; requestedAt: string } | null;
  error?: string;
};

export default function JoinOrganizationPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const { data: session } = authClient.useSession();

  const token = useMemo(() => {
    const raw = params?.token;
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<JoinPayload | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v2/join/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });

      const body = (await response.json().catch(() => null)) as JoinPayload | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Join link is invalid or unavailable");
      }

      setPayload(body ?? null);
    } catch (cause) {
      if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unable to load join link");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const requestJoin = async () => {
    if (!token) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v2/join/${encodeURIComponent(token)}/request`, {
        method: "POST",
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to submit join request");
      }

      await refresh();
    } catch (cause) {
      if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Failed to submit join request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goToDashboard = async () => {
    if (!payload?.organization?.id) {
      router.push("/dashboard/control-plane");
      return;
    }

    try {
      await authClient.organization.setActive({
        organizationId: payload.organization.id,
      });
    } catch {
    }

    window.dispatchEvent(new CustomEvent("organization-changed"));
    router.push("/dashboard/control-plane");
  };

  const signInHref = token
    ? `/login?next=${encodeURIComponent(`/join/${token}`)}`
    : "/login";

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl items-center justify-center p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Join Organization</CardTitle>
          <CardDescription>
            {payload?.organization?.name
              ? `Request access to ${payload.organization.name}`
              : "Use a valid join link to request access."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Loading join link...</p> : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {!loading && !error && payload?.authRequired ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to request access to this organization.
              </p>
              <Button asChild>
                <a href={signInHref}>Sign in to continue</a>
              </Button>
            </div>
          ) : null}

          {!loading && !error && payload?.membership ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You are already a member of this organization.
              </p>
              <Button onClick={() => void goToDashboard()}>Go to dashboard</Button>
            </div>
          ) : null}

          {!loading && !error && !payload?.authRequired && !payload?.membership ? (
            <div className="space-y-3">
              {payload?.request?.status === "pending" ? (
                <p className="text-sm text-muted-foreground">
                  Request submitted. An owner or admin will review it shortly.
                </p>
              ) : payload?.request?.status === "rejected" ? (
                <p className="text-sm text-muted-foreground">
                  Your last request was rejected. You can submit a new request.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Request access to join this organization.
                </p>
              )}

              <Button
                onClick={() => void requestJoin()}
                disabled={submitting || payload?.request?.status === "pending"}
              >
                {submitting ? "Submitting..." : payload?.request?.status === "pending" ? "Request pending" : "Request access"}
              </Button>
            </div>
          ) : null}

          {session?.user?.email ? (
            <p className="text-xs text-muted-foreground">Signed in as {session.user.email}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
