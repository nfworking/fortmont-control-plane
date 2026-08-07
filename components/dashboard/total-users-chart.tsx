"use client"

import { useState } from "react"
import { Settings2, TrendingUp } from "lucide-react"

const TABS = ["Total Users", "New Users", "Retention"] as const
type Tab = (typeof TABS)[number]

const SERIES: Record<Tab, { total: string; points: number[]; footer: string }> = {
  "Total Users": {
    total: "3",
    points: [1, 1, 1, 1, 1, 1, 1.2, 3],
    footer: "100.0% increase from previous week",
  },
  "New Users": {
    total: "2",
    points: [0, 0, 1, 0, 0, 1, 0, 2],
    footer: "50.0% increase from previous week",
  },
  Retention: {
    total: "67%",
    points: [40, 45, 42, 55, 60, 58, 62, 67],
    footer: "8.0% increase from previous week",
  },
}

const X_LABELS = ["Jun 26", "Jul 3", "Jul 10", "Jul 17", "Jul 24", "Jul 31", "Aug 7"]

const W = 640
const H = 220
const PAD_X = 8
const PAD_Y = 24

function buildPath(points: number[]) {
  const max = Math.max(...points, 1)
  const stepX = (W - PAD_X * 2) / (points.length - 1)
  const coords = points.map((p, i) => {
    const x = PAD_X + i * stepX
    const y = H - PAD_Y - (p / max) * (H - PAD_Y * 2)
    return [x, y] as const
  })
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ")
  const area = `${line} L ${coords[coords.length - 1][0]} ${H} L ${coords[0][0]} ${H} Z`
  return { line, area, coords }
}

export function TotalUsersChart() {
  const [active, setActive] = useState<Tab>("Total Users")
  const data = SERIES[active]
  const { line, area, coords } = buildPath(data.points)

  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActive(tab)}
              className={`text-sm transition-colors ${
                active === tab
                  ? "font-medium text-foreground underline underline-offset-8 decoration-2"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Chart settings"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1 px-5 pt-4">
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {active}
          </span>
          <span className="text-xs text-muted-foreground">Last 8 weeks</span>
        </div>
        <span className="text-4xl font-semibold tabular-nums">{data.total}</span>
      </div>

      <div className="px-2 pt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[200px] w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${active} trend over the last 8 weeks`}
        >
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.97 0 0)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="oklch(0.97 0 0)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#chartFill)" />
          <path d={line} fill="none" stroke="oklch(0.85 0 0)" strokeWidth={2} strokeLinejoin="round" />
          {coords.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.5} fill="oklch(0.85 0 0)" />
          ))}
        </svg>
      </div>

      <div className="flex justify-between px-5 pb-2 font-mono text-[11px] text-muted-foreground">
        {X_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-1.5 border-t border-border px-5 py-3 text-xs text-emerald-500">
        <TrendingUp className="h-3.5 w-3.5" />
        <span className="font-medium">{data.footer}</span>
      </div>
    </section>
  )
}
