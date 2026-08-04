"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHero, DashboardPage, DashboardSection } from "@/components/dashboard/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Agent = {
  id: string;
  name: string;
  description: string | null;
  deviceId: string;
  hostname: string;
  platform: string;
  architecture: string;
  version: string;
  connected: boolean;
  lastSeen: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type JoinToken = {
  id: string;
  label: string | null;
  maxUses: number;
  usesCount: number;
  revoked: boolean;
  expiresAt: string;
  createdAt: string;
  createdByUserId: string | null;
};

type AgentTokenResult = {
  token: string;
  tokenInfo: JoinToken;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ControlPlaneAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tokens, setTokens] = useState<JoinToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);

  const [tokenLabel, setTokenLabel] = useState("");
  const [tokenMaxUses, setTokenMaxUses] = useState(1);
  const [tokenExpiresInHours, setTokenExpiresInHours] = useState(24);
  const [creatingToken, setCreatingToken] = useState(false);
  const [lastGeneratedToken, setLastGeneratedToken] = useState<AgentTokenResult | null>(null);
  const [orgRefreshToken, setOrgRefreshToken] = useState(0);

  const connectedCount = useMemo(
    () => agents.filter((entry) => entry.connected).length,
    [agents],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [agentsResponse, tokensResponse] = await Promise.all([
        fetch("/api/v2/organization/agents", { cache: "no-store" }),
        fetch("/api/v2/organization/agents/join-tokens", { cache: "no-store" }),
      ]);

      if (!agentsResponse.ok) {
        throw new Error(`Failed to load agents (${agentsResponse.status})`);
      }

      if (!tokensResponse.ok) {
        throw new Error(`Failed to load join tokens (${tokensResponse.status})`);
      }

      const [agentsJson, tokensJson] = await Promise.all([
        agentsResponse.json(),
        tokensResponse.json(),
      ]);

      setAgents((agentsJson.agents ?? []) as Agent[]);
      setTokens((tokensJson.tokens ?? []) as JoinToken[]);
    } catch (cause) {
      if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unknown error while loading agents");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData, orgRefreshToken]);

  useEffect(() => {
    const handleOrganizationChange = () => {
      setOrgRefreshToken((value) => value + 1);
    };

    window.addEventListener("organization-changed", handleOrganizationChange);
    return () => {
      window.removeEventListener("organization-changed", handleOrganizationChange);
    };
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/v2/organization/agents/stream");

    source.addEventListener("connected", () => {
      setLoading(false);
    });

    source.addEventListener("agents", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          agents?: Agent[];
        };

        setAgents(payload.agents ?? []);
        setLoading(false);
      } catch {
      }
    });

    source.onerror = () => {
      void fetchData();
    };

    return () => {
      source.close();
    };
  }, [fetchData, orgRefreshToken]);

  const sampleJoinCommand = useMemo(() => {
    if (!lastGeneratedToken?.token) return null;

    return `go run ./samples/agent --server-url http://localhost:3000 --token ${lastGeneratedToken.token}`;
  }, [lastGeneratedToken]);

  const generateJoinToken = async () => {
    setCreatingToken(true);
    setError(null);

    try {
      const response = await fetch("/api/v2/organization/agents/join-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: tokenLabel || null,
          maxUses: tokenMaxUses,
          expiresInHours: tokenExpiresInHours,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { token?: string; tokenInfo?: JoinToken; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.error ?? `Failed to generate token (${response.status})`);
      }

      if (body?.token && body.tokenInfo) {
        setLastGeneratedToken({
          token: body.token,
          tokenInfo: body.tokenInfo,
        });
        setRegisterDialogOpen(false);
        setTokenLabel("");
        setTokenMaxUses(1);
        setTokenExpiresInHours(24);
      }
      await fetchData();
    } catch (cause) {
      if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unknown error while generating join token");
      }
    } finally {
      setCreatingToken(false);
    }
  };

  const unregisterAgent = async (id: string) => {
    setError(null);

    try {
      const response = await fetch(`/api/v2/organization/agents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Failed to unregister agent (${response.status})`);
      }

      await fetchData();
    } catch (cause) {
      if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unknown error while unregistering agent");
      }
    }
  };

  const revokeJoinToken = async (tokenId: string) => {
    setError(null);

    try {
      const response = await fetch(`/api/v2/organization/agents/join-tokens?tokenId=${encodeURIComponent(tokenId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Failed to revoke token (${response.status})`);
      }

      await fetchData();
    } catch (cause) {
      if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unknown error while revoking token");
      }
    }
  };

  return (
    <DashboardPage>
      <DashboardHero
        eyebrow="Control Plane"
        title="Agent Registry"
        description="Click Register Agent to mint an enrollment token, then run that token in your agent client. Once the agent connects to heartbeat SSE, this table updates live."
        badge={
          <Badge variant={connectedCount > 0 ? "default" : "secondary"}>
            {connectedCount}/{agents.length} online
          </Badge>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void fetchData()} disabled={loading}>
              Refresh
            </Button>
            <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
              <DialogTrigger asChild>
                <Button>Register Agent</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Register Agent</DialogTitle>
                  <DialogDescription>
                    Generate a join token to enroll a new agent instance.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="token-label">Label</Label>
                    <Input
                      id="token-label"
                      placeholder="Office NUC 04"
                      value={tokenLabel}
                      onChange={(event) => setTokenLabel(event.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="max-uses">Max Uses</Label>
                      <Input
                        id="max-uses"
                        type="number"
                        min={1}
                        max={1000}
                        value={tokenMaxUses}
                        onChange={(event) => setTokenMaxUses(Number(event.target.value || 1))}
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="expires-hours">Expires In (hours)</Label>
                      <Input
                        id="expires-hours"
                        type="number"
                        min={1}
                        max={720}
                        value={tokenExpiresInHours}
                        onChange={(event) => setTokenExpiresInHours(Number(event.target.value || 24))}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    onClick={() => void generateJoinToken()}
                    disabled={creatingToken}
                  >
                    {creatingToken ? "Generating..." : "Generate Token"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {error ? (
        <DashboardSection title="Errors" description="Resolve API or validation issues below.">
          <p className="text-sm text-destructive">{error}</p>
        </DashboardSection>
      ) : null}

      <DashboardSection
        title="Enrollment Tokens"
        description="Each token can be passed once (or multiple times) to the agent CLI for secure registration."
      >
        {lastGeneratedToken ? (
          <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Copy now. This raw token is only shown once.</p>
            <p className="font-mono text-sm">{lastGeneratedToken.token}</p>
            {sampleJoinCommand ? (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Sample join command</p>
                <p className="font-mono text-xs">{sampleJoinCommand}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell>{token.label || "-"}</TableCell>
                <TableCell>{token.usesCount}/{token.maxUses}</TableCell>
                <TableCell>{formatDate(token.expiresAt)}</TableCell>
                <TableCell>{formatDate(token.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="destructive" size="sm" onClick={() => void revokeJoinToken(token.id)}>
                    Revoke
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!tokens.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No active tokens.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </DashboardSection>

      <DashboardSection
        title="Registered Agents"
        description="Live registry view (SSE-backed) sourced from agent outbound heartbeat connections."
      >
        {loading ? <p className="text-sm text-muted-foreground">Loading agents...</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Hostname</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead>Device ID</TableHead>
              <TableHead>Metadata</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{entry.name}</span>
                    <span className="text-xs text-muted-foreground">{entry.description || "-"}</span>
                  </div>
                </TableCell>
                <TableCell>{entry.version}</TableCell>
                <TableCell>{entry.platform}/{entry.architecture}</TableCell>
                <TableCell>{entry.hostname}</TableCell>
                <TableCell>
                  <div className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={entry.connected
                        ? "inline-block size-2 rounded-full bg-green-500 shadow-[0_0_10px_2px_rgba(34,197,94,0.85)]"
                        : "inline-block size-2 rounded-full bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.85)]"
                      }
                    />
                    <Badge variant={entry.connected ? "default" : "secondary"}>
                      {entry.connected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>{formatDate(entry.lastSeen)}</TableCell>
                <TableCell className="font-mono text-xs">{entry.deviceId}</TableCell>
                <TableCell className="max-w-80 truncate font-mono text-xs text-muted-foreground">
                  {entry.metadata ? JSON.stringify(entry.metadata) : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void unregisterAgent(entry.id)}
                  >
                    Unregister
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!agents.length && !loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  No agents registered yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </DashboardSection>
    </DashboardPage>
  );
}
