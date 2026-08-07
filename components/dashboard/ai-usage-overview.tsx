import { Settings2, Cpu } from "lucide-react"

type ModelUsage = {
  name: string
  tokens: string
  percent: number
}

const MODELS: ModelUsage[] = [
  { name: "gpt-4o", tokens: "1.24M", percent: 42 },
  { name: "claude-sonnet", tokens: "0.89M", percent: 30 },
  { name: "gemini-2.5", tokens: "0.41M", percent: 14 },
  { name: "llama-3.3", tokens: "0.22M", percent: 8 },
  { name: "mistral-large", tokens: "0.18M", percent: 6 },
]

export function AiUsageOverview() {
  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            AI Usage Overview
          </span>
        </div>
        <button
          type="button"
          aria-label="AI usage settings"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-border px-5 py-4">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total tokens (30d)</span>
        <div className="mt-1 text-2xl font-semibold tabular-nums">2.94M</div>
      </div>

      <ul className="flex flex-1 flex-col justify-center gap-4 px-5 py-4">
        {MODELS.map((model, i) => (
          <li key={model.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <span className="w-5 font-mono text-xs text-muted-foreground">#{i + 1}</span>
                <span className="font-mono">{model.name}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="tabular-nums">{model.tokens}</span>
                <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                  {model.percent}%
                </span>
              </div>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-foreground/70" style={{ width: `${model.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
