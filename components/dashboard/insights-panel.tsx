import { Lightbulb, Shield, Settings, ArrowUpCircle, Gauge, Package, GitBranch, Mail, LifeBuoy } from "lucide-react"

type Insight = {
  category: string
  categoryColor: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}

const INSIGHTS: Insight[] = [
  {
    category: "SECURITY",
    categoryColor: "text-amber-500",
    icon: Shield,
    title: "IP Address Headers Not Configured",
    body: "Configure IP headers based on your deployment platform for accurate rate limiting.",
  },
  {
    category: "CONFIGURATION",
    categoryColor: "text-sky-400",
    icon: Settings,
    title: "OAuth Error Page Not Configured",
    body: "Set a custom error URL so OAuth failures redirect users to your app instead of the default development error page.",
  },
  {
    category: "UPDATE",
    categoryColor: "text-cyan-400",
    icon: ArrowUpCircle,
    title: "Update Available",
    body: "New version 1.6.26 is available. You're on 1.6.25.",
  },
  {
    category: "PERFORMANCE",
    categoryColor: "text-orange-500",
    icon: Gauge,
    title: "Enable Experimental Joins",
    body: "Enable database joins for significantly faster query performance (2-3x improvement).",
  },
]

export function InsightsPanel() {
  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Lightbulb className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Insights</span>
      </div>

      <ul className="flex flex-1 flex-col">
        {INSIGHTS.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.title} className="flex gap-3 border-b border-border/60 px-5 py-4 last:border-0">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                <Icon className={`h-3.5 w-3.5 ${item.categoryColor}`} />
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${item.categoryColor}`}>
                    {item.category}
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${item.categoryColor.replace("text-", "bg-")}`} />
                </div>
                <h3 className="text-sm font-medium leading-snug">{item.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{item.body}</p>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Status footer */}
      <div className="mt-auto flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Online
          </span>
          <span className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            v1.6.25
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              update
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />4 plugins
          </span>
        </div>
        <div className="flex items-center gap-3">
          <GitBranch className="h-3.5 w-3.5 transition-colors hover:text-foreground" />
          <Mail className="h-3.5 w-3.5 transition-colors hover:text-foreground" />
          <LifeBuoy className="h-3.5 w-3.5 transition-colors hover:text-foreground" />
        </div>
      </div>
    </section>
  )
}
