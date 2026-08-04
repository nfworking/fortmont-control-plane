"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { authClient } from "@/lib/auth-client";
import packageJson from "@/package.json";

interface TelemetryPoint {
  time: string;
  timestamp: number;
  cpu: number | null;
  memory: number | null;
  storage: number | null;
}

interface CurrentTelemetry {
  cpuUsagePercent: number | null;
  memoryUsagePercent: number | null;
  storageUsagePercent: number | null;
}

export default function ControlPlaneServerPage() {
  const { data: session, isPending } = authClient.useSession();
  const [serverStatus, setServerStatus] = useState<"healthy" | "degraded" | "offline">("healthy");
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h">("1h");
  
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  const [telemetry, setTelemetry] = useState<CurrentTelemetry>({
    cpuUsagePercent: null,
    memoryUsagePercent: null,
    storageUsagePercent: null,
  });

  useEffect(() => {
    async function fetchHistoricalData() {
      try {
        setLoadingHistory(true);
        const res = await fetch(`/api/v2/server/metrics/history?range=${timeRange}&deviceId=sample-1785765144-5864`);
        if (!res.ok) throw new Error("History fetch failed");

        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) {
          setHistory(json.data);

          // Find the last non-null metric point from Influx
          const validPoints = json.data.filter((p: TelemetryPoint) => p.cpu !== null || p.memory !== null);
          const latest = validPoints[validPoints.length - 1];

          // Check if agent is currently offline (no data in the most recent point)
          const absoluteLatest = json.data[json.data.length - 1];
          const isAgentOffline = absoluteLatest && absoluteLatest.cpu === null;

          if (isAgentOffline) {
            setServerStatus("offline");
          } else {
            setServerStatus("healthy");
          }

          if (latest) {
            setTelemetry({
              cpuUsagePercent: latest.cpu,
              memoryUsagePercent: latest.memory,
              storageUsagePercent: latest.storage,
            });
          }
        }
      } catch (err) {
        console.error("Error pulling metric history:", err);
        setServerStatus("degraded");
      } finally {
        setLoadingHistory(false);
      }
    }

    fetchHistoricalData();
    const interval = setInterval(fetchHistoricalData, 10_000);
    return () => clearInterval(interval);
  }, [timeRange]);

  return (
    <div className="flex flex-col gap-6 p-1 max-w-7xl mx-auto w-full mt-35">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">API Server</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                serverStatus === "healthy"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : serverStatus === "offline"
                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  serverStatus === "healthy"
                    ? "bg-emerald-500"
                    : serverStatus === "offline"
                    ? "bg-rose-500"
                    : "bg-amber-500"
                } animate-pulse`}
              />
              {serverStatus === "healthy"
                ? "Operational"
                : serverStatus === "offline"
                ? "Agent Offline"
                : "Degraded"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time status, environment configuration, and historical system telemetry.
          </p>
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-3 bg-muted/40 p-2 rounded-lg border border-border/50 text-xs">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold uppercase">
            {isPending ? "..." : session?.user?.name?.[0] || session?.user?.email?.[0] || "?"}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {isPending ? "Loading..." : session?.user?.name || "Authenticated Session"}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {isPending ? "Fetching session..." : session?.user?.email || "No session active"}
            </span>
          </div>
        </div>
      </div>

      {/* Info Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground">Version</span>
          <div className="text-xl font-bold tracking-tight mt-1">v{packageJson.version}</div>
          <span className="text-[11px] text-muted-foreground mt-1 block">From package.json</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground">Environment</span>
          <div className="text-xl font-bold tracking-tight mt-1 capitalize">
            {process.env.NODE_ENV || "production"}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Node Runtime</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground">System Uptime</span>
          <div className="text-xl font-bold tracking-tight mt-1">99.98%</div>
          <span className="text-[11px] text-emerald-500 mt-1 block">↑ 14 days uninterrupted</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground">Active Session</span>
          <div className="text-sm font-semibold truncate mt-1">
            {session?.user?.id ? `ID: ${session.user.id.slice(0, 12)}...` : "Unauthenticated"}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">Better-Auth Session</span>
        </div>
      </div>

      {/* Historical Telemetry Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-xl border border-border bg-card flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">System Metrics History</h2>
              <p className="text-xs text-muted-foreground">Continuous InfluxDB timeline with downtime gaps</p>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50 self-start sm:self-auto">
              {(["1h", "6h", "24h"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    timeRange === range
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            {loadingHistory && history.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                Querying InfluxDB timeline...
              </div>
            ) : history.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                No telemetry recorded for this timeframe.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="time" tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickLine={false} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0, 0, 0, 0.85)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                    formatter={(value: any) => [value !== null ? `${value}%` : "No Signal (Offline)", ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    name="CPU"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#cpuGrad)"
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    name="RAM"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#memGrad)"
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Current Allocation Gauges */}
        <div className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between gap-4">
          <h2 className="text-base font-semibold">Latest Snapshot</h2>
          <div className="space-y-4">
            {/* CPU Gauge */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">CPU Usage</span>
                <span className="font-medium">
                  {telemetry.cpuUsagePercent !== null ? `${telemetry.cpuUsagePercent}%` : "Offline"}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(telemetry.cpuUsagePercent ?? 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory Gauge */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Memory (RAM)</span>
                <span className="font-medium">
                  {telemetry.memoryUsagePercent !== null ? `${telemetry.memoryUsagePercent}%` : "Offline"}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(telemetry.memoryUsagePercent ?? 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Storage Gauge */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-medium">
                  {telemetry.storageUsagePercent !== null ? `${telemetry.storageUsagePercent}%` : "Offline"}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(telemetry.storageUsagePercent ?? 0, 100)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground text-center">
            Streamed via InfluxDB Cloud
          </div>
        </div>
      </div>

      {/* Logs Console Container */}
      <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Live Server Logs</h2>
            <p className="text-xs text-muted-foreground">Real-time HTTP requests and execution logs</p>
          </div>
          <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded">
            STDOUT / STDERR
          </span>
        </div>

        <div className="rounded-lg bg-black/90 text-emerald-400 font-mono text-xs p-4 overflow-x-auto border border-border space-y-1.5 min-h-[160px]">
          <p className="text-muted-foreground">[SYSTEM] Initializing server control plane dashboard...</p>
          <p><span className="text-blue-400">[INFO]</span> Auth engine loaded via Better-Auth client.</p>
          <p><span className="text-emerald-400">[INFO]</span> Continuous InfluxDB time window tracking active.</p>
          <p className="text-muted-foreground/60 animate-pulse">&gt; Listening for incoming telemetry...</p>
        </div>
      </div>
    </div>
  );
}