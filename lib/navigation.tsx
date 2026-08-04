"use client"

import * as React from "react"
import {
  GitFork,
  User,
  Sliders,
  Shield,
  Smartphone,
  Key,
  Code,
  CommandIcon,
  GlobeLock,
  CloudIcon,
  LayoutDashboardIcon,
  MailIcon,
  NetworkIcon,
  Database,
  EthernetPort,
  Ticket,
  Folder,
  Clock,
  Users,
  Trash2,
} from "lucide-react"

export interface NavItem {
  title: string
  url: string
  icon?: React.ReactNode
  badge?: string | number
  badgeVariant?: "orange" | "blue" | "green"
  section?: number
  onClick?: (e: React.MouseEvent) => void
}

export interface NavigationConfig {
  main: NavItem[]
  nested?: Record<
    string,
    {
      parentTitle: string
      parentUrl: string
      items: NavItem[]
    }
  >
}

export const baseNavigationConfig: NavigationConfig = {
  main: [
    { title: "Dashboard", url: "/dashboard/control-plane", icon: <LayoutDashboardIcon />, section: 1 },
    { title: "Agents", url: "/dashboard/control-plane/agents", icon: <Sliders />, section: 1 },
    { title: "AI", url: "/dashboard/control-plane/ai/overview", icon: <CommandIcon />, section: 1 },
  ],
  nested: {
    "/dashboard/control-plane/ai": {
      parentTitle: "AI Home",
      parentUrl: "/dashboard/control-plane/ai/overview",
      items: [
        { title: "Dashboard", url: "/dashboard/control-plane/ai/overview", icon: <LayoutDashboardIcon /> },
        { title: "Providers", url: "/dashboard/control-plane/ai/providers", icon: <Sliders /> },
        { title: "Chat", url: "/dashboard/control-plane/ai/chat", icon: <GlobeLock /> },
      ],
    },
  },
}

export function useNavigationConfig(): NavigationConfig {
  return React.useMemo(() => baseNavigationConfig, [])
}