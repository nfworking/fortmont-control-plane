"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, ArrowLeft } from "lucide-react"
import { useNavigationConfig, type NavItem } from "@/lib/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type { NavItem }

export function NavMain({
  items,
}: {
  items: NavItem[]
  isGithubLinked?: boolean
}) {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Quick focus search shortcut ('F' or '/')
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "f" || e.key === "F" || e.key === "/") &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Check for active nested section (e.g. /admin_ticketing)
  const navigationConfig = useNavigationConfig()
  const activeNestedKey = Object.keys(navigationConfig.nested || {}).find((prefix) =>
    pathname.startsWith(prefix)
  )
  const nestedConfig = activeNestedKey ? navigationConfig.nested?.[activeNestedKey] : null
  const currentItems = nestedConfig ? nestedConfig.items : items

  const filteredItems = currentItems.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const renderMenuList = (itemList: NavItem[]) => (
    <SidebarMenu className="gap-1">
      {itemList.map((item) => {
        const isActive =
          pathname === item.url ||
          (item.url !== "/dashboard/control-plane" && pathname.startsWith(item.url + "/"))

        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              tooltip={item.title}
              isActive={isActive}
              onClick={item.onClick}
              className={`
                group relative flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors
                ${
                  isActive
                    ? "bg-black-50 text-foreground dark:bg-white dark:text-black font-semibold"
                    : "text-muted-foreground hover:bg-zinc-200/60 dark:hover:bg-zinc-800/50 hover:text-foreground"
                }
              `}
            >
              <Link href={item.url} className="flex w-full items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="size-4 shrink-0 ">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.title}</span>
                </div>

                {item.badge && (
                  <span
                    className={`ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                      item.badgeVariant === "orange"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : item.badgeVariant === "blue"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : item.badgeVariant === "green"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )

  return (
    <SidebarGroup className="px-3 py-2">
      <SidebarGroupContent className="flex flex-col gap-3">
        {/* Nested Header / Back Button if inside a section like Ticketing */}
        {nestedConfig && (
          <div className="mb-1 flex flex-col gap-1 border-b border-sidebar-border pb-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-sidebar-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Home</span>
            </Link>
            <span className="text-sm font-semibold text-sidebar-foreground px-0.5 pt-1">
              {nestedConfig.parentTitle}
            </span>
          </div>
        )}

        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Find"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-ring"
          />
          <kbd className="pointer-events-none absolute right-2 flex h-4 select-none items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            F
          </kbd>
        </div>

        {/* Render Navigation List */}
        {filteredItems.length > 0 ? (
          renderMenuList(filteredItems)
        ) : (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No results found.
          </p>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}