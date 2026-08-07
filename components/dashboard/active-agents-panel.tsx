"use client"

import { useEffect, useMemo, useState } from "react"
import { Settings2, Copy, Check } from "lucide-react"

interface Agent {
  id: string
  name?: string
  hostname?: string
  localIp?: string | null
  publicIp?: string | null
  connected: boolean
  lastSeen?: string
  createdAt?: string
}

interface Organization {
  id: string
  name: string
  slug: string
}

type SseStatus = "connected" | "connecting" | "disconnected"

function Metric({
  label,
  description,
  value,
  changeLabel,
  tone,
}: {
  label: string
  description: string
  value: number
  changeLabel: string
  tone: "positive" | "muted"
}) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-6 p-5">
      <div>
        <h3 className="text-base font-semibold tracking-tight">{label}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span
          className={`text-5xl font-semibold tabular-nums leading-none ${
            tone === "positive" && value > 0 ? "text-emerald-500" : ""
          }`}
        >
          {value}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{changeLabel}</span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: SseStatus }) {
  const styles =
    status === "connected"
      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      : status === "connecting"
        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
        : "bg-rose-500/10 text-rose-500 border-rose-500/20"
  const dot =
    status === "connected"
      ? "bg-emerald-500 animate-pulse"
      : status === "connecting"
        ? "bg-amber-500"
        : "bg-rose-500"
  const text =
    status === "connected" ? "Live" : status === "connecting" ? "Connecting…" : "Offline"

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  )
}

export function ActiveAgentsPanel() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [sseStatus, setSseStatus] = useState<SseStatus>("connecting")
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null)
  const [copiedOrgId, setCopiedOrgId] = useState(false)
  const [orgRefreshToken, setOrgRefreshToken] = useState(0)

  // Connect to the live SSE agents stream
  useEffect(() => {
    const eventSource = new EventSource("/api/v2/organization/agents/stream")

    eventSource.onopen = () => {
      setSseStatus("connected")
    }

    eventSource.addEventListener("agents", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data)
        if (Array.isArray(payload.agents)) {
          setAgents(payload.agents)
        }
      } catch (err) {
        console.error("Failed to parse incoming agent SSE payload", err)
      }
    })

    eventSource.onerror = () => {
      setSseStatus("disconnected")
    }

    return () => {
      eventSource.close()
    }
  }, [])

  // Re-fetch the active organization when it changes elsewhere in the app
  useEffect(() => {
    const handleOrganizationChange = () => {
      setOrgRefreshToken((value) => value + 1)
    }
    window.addEventListener("organization-changed", handleOrganizationChange)
    return () => {
      window.removeEventListener("organization-changed", handleOrganizationChange)
    }
  }, [])

  // Load the currently active organization
  useEffect(() => {
    let cancelled = false
    const loadOrganization = async () => {
      try {
        const response = await fetch("/api/v2/organization/active", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Failed to load active organization")
        }
        const payload = await response.json()
        if (!cancelled) {
          setActiveOrganization(payload.organization ?? null)
        }
      } catch (error) {
        console.error("Failed to load active organization", error)
      }
    }
    void loadOrganization()
    return () => {
      cancelled = true
    }
  }, [orgRefreshToken])

  const orgIdLabel = useMemo(
    () => activeOrganization?.id ?? "No organization selected",
    [activeOrganization],
  )

  const copyOrganizationId = async () => {
    if (!activeOrganization?.id) return
    try {
      await navigator.clipboard.writeText(activeOrganization.id)
      setCopiedOrgId(true)
      window.setTimeout(() => setCopiedOrgId(false), 1800)
    } catch (error) {
      console.error("Failed to copy organization ID", error)
    }
  }

  const activeAgentsCount = agents.filter((a) => a.connected).length
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const newAgentsCount = agents.filter(
    (a) => a.createdAt && new Date(a.createdAt).getTime() >= dayAgo,
  ).length
  const offlineCount = agents.length - activeAgentsCount

  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium">Agents</span>
          <StatusBadge status={sseStatus} />
        </div>
        <button
          type="button"
          aria-label="Agent panel settings"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <Metric
        label="Current Active Agents"
        description="Agents connected right now"
        value={activeAgentsCount}
        changeLabel={`${offlineCount} offline or timed out`}
        tone="positive"
      />

      <div className="border-t border-border" />

      <Metric
        label="New Agents"
        description="Agents enrolled in the last 24 hours"
        value={newAgentsCount}
        changeLabel={`${agents.length} registered total`}
        tone="muted"
      />

      <div className="mt-auto border-t border-border p-5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Active Organization
        </span>
        <div className="mt-2 flex items-center gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">
              {activeOrganization?.name ?? "No organization selected"}
            </div>
            <div className="truncate font-mono text-xs text-muted-foreground">{orgIdLabel}</div>
          </div>
          {activeOrganization?.id ? (
            <button
              type="button"
              onClick={() => void copyOrganizationId()}
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:text-foreground"
              aria-label="Copy organization ID"
            >
              {copiedOrgId ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
        <span className="mt-2 block text-xs text-muted-foreground">
          Use this ID when enrolling an agent
        </span>
      </div>
    </section>
  )
}
