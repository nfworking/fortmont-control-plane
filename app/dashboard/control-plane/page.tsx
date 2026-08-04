"use client";

import { useEffect, useState } from "react";
import packageJson from "@/package.json";

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

interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "SYSTEM";
  message: string;
}

export default function ControlPlaneDashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sseStatus, setSseStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // 1. Calculate Uptime locally (or hydrate from server)
  useEffect(() => {
    const timer = setInterval(() => {
      setUptimeSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (totalSeconds: number) => {
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(" ");
  };

  // Helper to add log entries dynamically
  const appendLog = (level: LogEntry["level"], message: string) => {
    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 49)]); // keep latest 50 logs
  };

  // 2. Connect to live SSE Agents stream
  useEffect(() => {
    appendLog("SYSTEM", "Initializing SSE channel connection to /api/v2/agents/stream...");
    const eventSource = new EventSource("/api/v2/agents/stream");

    eventSource.onopen = () => {
      setSseStatus("connected");
      appendLog("INFO", "SSE Stream established. Receiving agent telemetry.");
    };

    eventSource.addEventListener("connected", (event) => {
      try {
        const data = JSON.parse(event.data);
        appendLog("SYSTEM", `Handshake acknowledged via ${data.protocol || "SSE"}.`);
      } catch (err) {
        // ignore parse error
      }
    });

    eventSource.addEventListener("agents", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (Array.isArray(payload.agents)) {
          setAgents(payload.agents);
        }
      } catch (err) {
        appendLog("ERROR", "Failed to parse incoming agent SSE payload.");
      }
    });

    eventSource.onerror = () => {
      setSseStatus("disconnected");
      appendLog("WARN", "SSE Connection dropped. Retrying...");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const activeAgentsCount = agents.filter((a) => a.connected).length;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full text-foreground bg-background">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Control Plane Dashboard</h1>
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

        {/* Server Uptime */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Server Uptime
          </span>
          <div className="text-2xl font-bold tracking-tight mt-1 font-mono">
            {formatUptime(uptimeSeconds)}
          </div>
          <span className="text-xs text-emerald-500 mt-1 block">Continuous Process Runtime</span>
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

      {/* Pure Black Live System Logs Console */}
      <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Live System Logs</h2>
            <p className="text-xs text-muted-foreground">Streaming real-time control plane events</p>
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted border border-border transition-colors"
          >
            Clear Console
          </button>
        </div>

        {/* Pitch Black Pure Black (#000000) Log Container */}
        <div className="rounded-lg bg-[#000000] text-xs font-mono p-4 border border-border space-y-1.5 h-48 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-muted-foreground/50 italic">&gt; Console empty. Waiting for events...</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="text-muted-foreground/60 select-none">[{log.timestamp}]</span>
                <span
                  className={`font-semibold px-1 rounded text-[10px] ${
                    log.level === "INFO"
                      ? "bg-blue-950 text-blue-400"
                      : log.level === "WARN"
                      ? "bg-amber-950 text-amber-400"
                      : log.level === "ERROR"
                      ? "bg-rose-950 text-rose-400"
                      : "bg-emerald-950 text-emerald-400"
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-zinc-300 break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}