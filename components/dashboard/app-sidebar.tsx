"use client"

import * as React from "react"
import Link from "next/link"

import { NavMain } from "@/components/common/nav-main"
import { useNavigationConfig } from "@/lib/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Command } from "lucide-react"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: {
    name?: string | null
    email?: string | null
    avatar?: string | null
  } | null
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const navigationConfig = useNavigationConfig()

  return (
    <Sidebar
      collapsible="offcanvas"
      {...props}
      className="h-full border-r border-sidebar-border bg-sidebar rounded-r-xl overflow-hidden"
    >
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="flex aspect-square size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="text-sm font-semibold text-sidebar-foreground">Fortmont Control Plane</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        <NavMain items={navigationConfig.main} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}