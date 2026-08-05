"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import packageJson from "@/package.json";
import { authClient } from "@/lib/auth-client";

interface Agent {
  id: string;
  name?: string;
  hostname?: string;
  localIp?: string | null;
  publicIp?: string | null;
  connected: boolean;
  lastSeen?: string;
  createdAt?: string;
}

interface AuditLogEntry {
  id: string;
  createdAt: string;
  category: string;
  action: string;
  outcome: "success" | "failure" | "denied" | "info" | string;
  actorType: string;
  actorEmail?: string | null;
  deviceId?: string | null;
  message: string;
  ipAddress?: string | null;
}

export default function ControlPlaneDashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sseStatus, setSseStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [activeOrganization, setActiveOrganization] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [copiedOrgId, setCopiedOrgId] = useState(false);
  const [orgRefreshToken, setOrgRefreshToken] = useState(0);

  // 1. Connect to live SSE Agents stream
  useEffect(() => {
    const eventSource = new EventSource("/api/v2/organization/agents/stream");

    eventSource.onopen = () => {
      setSseStatus("connected");
    };

    eventSource.addEventListener("connected", () => {
      // keep this listener to ensure stream handshake is consumed.
    });

    eventSource.addEventListener("agents", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (Array.isArray(payload.agents)) {
          setAgents(payload.agents);
        }
      } catch (err) {
        console.error("Failed to parse incoming agent SSE payload", err);
      }
    });

    eventSource.onerror = () => {
      setSseStatus("disconnected");
    };

    return () => {
      eventSource.close();
    };
  }, [orgRefreshToken]);

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
    const mounted = true;

    const loadOrganization = async () => {
      try {
        const response = await fetch("/api/v2/organization/active", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load active organization");
        }

        const payload = await response.json();
        if (mounted) {
          setActiveOrganization(payload.organization ?? null);
        }
      } catch (error) {
        console.error("Failed to load active organization", error);
      }
    };

    void loadOrganization();
  }, [orgRefreshToken]);

  // 2. Load persisted audit log feed for operator visibility
  useEffect(() => {
    let mounted = true;

    const fetchAuditLogs = async () => {
      try {
        if (mounted) {
          setAuditError(null);
        }

        const response = await fetch("/api/v2/audit-logs?limit=50", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Audit fetch failed with status ${response.status}`);
        }

        const payload = await response.json();
        if (mounted && Array.isArray(payload.items)) {
          setAuditLogs(payload.items);
          setAuditLoading(false);
        }
      } catch {
        if (mounted) {
          setAuditError("Unable to load audit logs");
          setAuditLoading(false);
        }
      }
    };

    void fetchAuditLogs();
    const interval = setInterval(() => {
      void fetchAuditLogs();
    }, 15_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const activeAgentsCount = agents.filter((a) => a.connected).length;
  const { data } = authClient.useSession();
  const orgIdLabel = useMemo(() => activeOrganization?.id ?? "No organization selected", [activeOrganization]);

  const copyOrganizationId = async () => {
    if (!activeOrganization?.id) return;

    try {
      await navigator.clipboard.writeText(activeOrganization.id);
      setCopiedOrgId(true);
      window.setTimeout(() => setCopiedOrgId(false), 1800);
    } catch (error) {
      console.error("Failed to copy organization ID", error);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full text-foreground bg-background">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Control Plane Dashboard</h1>
            <h1>Welcome back {data?.user?.name ?? "User"} 👋</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                sseStatus === "connected"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : sseStatus === "connecting"
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  : "bg-rose-500/10 text-rose-500 border-rose-500/20"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  sseStatus === "connected"
                    ? "bg-emerald-500 animate-pulse"
                    : sseStatus === "connecting"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
              />
              {sseStatus === "connected"
                ? "Live Stream Active"
                : sseStatus === "connecting"
                ? "Connecting Stream..."
                : "Stream Offline"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Global operational status, active agents registry, and live execution telemetry.
          </p>
        </div>
      </div>

      {/* Top Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Version */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Server Version
          </span>
          <div className="text-2xl font-bold tracking-tight mt-1">v{packageJson.version}</div>
          <span className="text-xs text-muted-foreground mt-1 block">Production Release</span>
        </div>

        {/* Active Organization */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active Organization
          </span>
          <div className="mt-2 flex items-center gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight truncate">
                {activeOrganization?.name ?? "No organization selected"}
              </div>
              <div className="font-mono text-xs text-muted-foreground truncate">{orgIdLabel}</div>
            </div>
            {activeOrganization?.id ? (
              <button
                type="button"
                onClick={() => void copyOrganizationId()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:text-foreground"
                aria-label="Copy organization ID"
              >
                {copiedOrgId ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground mt-2 block">Use this ID when enrolling an agent</span>
        </div>

        {/* Total Agents */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Registered Agents
          </span>
          <div className="text-2xl font-bold tracking-tight mt-1">{agents.length}</div>
          <span className="text-xs text-muted-foreground mt-1 block">Discovered in Database</span>
        </div>

        {/* Active Connected Agents */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active Connections
          </span>
          <div className="text-2xl font-bold tracking-tight mt-1 text-emerald-500">
            {activeAgentsCount}
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            {agents.length - activeAgentsCount} offline or timed out
          </span>
        </div>
      </div>

      {/* Main Agents Table */}
      <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Managed Agents</h2>
            <p className="text-xs text-muted-foreground">
              Live status and heartbeat evaluation based on 90s active window
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Count: {agents.length}
          </span>
        </div>

        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Agent ID / Name</th>
                <th className="p-3 font-medium">Hostname</th>
                <th className="p-3 font-medium">Local IP</th>
                <th className="p-3 font-medium">Public IP</th>
                <th className="p-3 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No agents detected or streaming data yet.
                  </td>
                </tr>
              ) : (
                agents.map((ag) => (
                  <tr key={ag.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-sans font-medium border ${
                          ag.connected
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            ag.connected ? "bg-emerald-500" : "bg-muted-foreground/40"
                          }`}
                        />
                        {ag.connected ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      {ag.name || ag.id}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {ag.hostname || "n/a"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {ag.localIp || "n/a"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {ag.publicIp || "n/a"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {ag.lastSeen ? new Date(ag.lastSeen).toLocaleTimeString() : "Never"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Persisted Audit Logs */}
      <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Audit Logs</h2>
            <p className="text-xs text-muted-foreground">Authentication and agent action history from database</p>
          </div>
          <span className="text-xs text-muted-foreground">Last 50 events</span>
        </div>

        <div className="rounded-lg border border-border overflow-x-auto">
          {auditLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading audit events...</div>
          ) : auditError ? (
            <div className="p-6 text-center text-xs text-rose-500">{auditError}</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No audit events recorded yet.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="p-3 font-medium">Time</th>
                  <th className="p-3 font-medium">Category</th>
                  <th className="p-3 font-medium">Action</th>
                  <th className="p-3 font-medium">Outcome</th>
                  <th className="p-3 font-medium">Actor</th>
                  <th className="p-3 font-medium">Device / IP</th>
                  <th className="p-3 font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/30 transition-colors align-top">
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-foreground">{entry.category}</td>
                    <td className="p-3 font-mono text-muted-foreground">{entry.action}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                          entry.outcome === "success"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : entry.outcome === "failure" || entry.outcome === "denied"
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {entry.outcome}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {entry.actorEmail || entry.actorType}
                    </td>
                    <td className="p-3 text-muted-foreground font-mono">
                      {entry.deviceId || "n/a"}
                      <br />
                      {entry.ipAddress || "n/a"}
                    </td>
                    <td className="p-3 text-muted-foreground">{entry.message || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}