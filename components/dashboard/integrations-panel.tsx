import { Settings2, MessageSquare, GitBranch, Database, Boxes, Webhook } from "lucide-react"

type Integration = {
  name: string
  icon: React.ComponentType<{ className?: string }>
  enabled: boolean
  agent: string
}

const INTEGRATIONS: Integration[] = [
  { name: "Slack", icon: MessageSquare, enabled: true, agent: "orchestrator-01" },
  { name: "GitHub", icon: GitBranch, enabled: true, agent: "orchestrator-01" },
  { name: "Postgres", icon: Database, enabled: true, agent: "data-worker-03" },
  { name: "Vector Store", icon: Boxes, enabled: false, agent: "retrieval-02" },
  { name: "Webhooks", icon: Webhook, enabled: true, agent: "edge-relay-05" },
]

export function IntegrationsPanel() {
  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-sm font-medium">Integrations</span>
        <button
          type="button"
          aria-label="Integration settings"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-5 py-2.5 font-normal">Integration</th>
              <th className="px-3 py-2.5 font-normal">Status</th>
              <th className="px-3 py-2.5 font-normal">Agent</th>
            </tr>
          </thead>
          <tbody>
            {INTEGRATIONS.map((item) => {
              const Icon = item.icon
              return (
                <tr key={item.name} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        item.enabled
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          item.enabled ? "bg-emerald-500" : "bg-muted-foreground/50"
                        }`}
                      />
                      {item.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{item.agent}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-auto border-t border-border px-5 py-2.5 text-right">
        <button type="button" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
          View all integrations →
        </button>
      </div>
    </section>
  )
}
