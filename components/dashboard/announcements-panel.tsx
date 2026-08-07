import { Megaphone } from "lucide-react"

type Announcement = {
  tag: "Release" | "Maintenance" | "Update"
  title: string
  body: string
  date: string
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    tag: "Release",
    title: "Agent runtime v2.4 is now live",
    body: "Faster cold starts and improved tool-call streaming across all managed agents.",
    date: "Aug 6",
  },
  {
    tag: "Update",
    title: "New Slack integration scopes",
    body: "Reconnect Slack to enable channel-scoped message posting for your agents.",
    date: "Aug 4",
  },
  {
    tag: "Maintenance",
    title: "Scheduled database maintenance",
    body: "Read replicas will fail over on Aug 9, 02:00 UTC. No action required.",
    date: "Aug 1",
  },
]

const TAG_STYLES: Record<Announcement["tag"], string> = {
  Release: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  Update: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  Maintenance: "border-amber-500/20 bg-amber-500/10 text-amber-400",
}

export function AnnouncementsPanel() {
  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Announcements</span>
        </div>
        <span className="text-xs text-muted-foreground">{ANNOUNCEMENTS.length} new</span>
      </div>

      <ul className="flex flex-col">
        {ANNOUNCEMENTS.map((item) => (
          <li
            key={item.title}
            className="flex flex-col gap-1.5 border-b border-border/60 px-5 py-4 last:border-0"
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${TAG_STYLES[item.tag]}`}
              >
                {item.tag}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{item.date}</span>
            </div>
            <h3 className="text-sm font-medium leading-snug text-pretty">{item.title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{item.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-border px-5 py-2.5 text-right">
        <button type="button" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
          View all announcements →
        </button>
      </div>
    </section>
  )
}
