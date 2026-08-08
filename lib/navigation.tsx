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
    { title: "Org IAM", url: "/dashboard/control-plane/iam", icon: <Users />, section: 1 },
    { title: "Intergrations", url: "/dashboard/control-plane/intergrations", icon: <Clock />, section: 1 },
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
    "/dashboard/control-plane/iam": {
      parentTitle: "IAM Home",
      parentUrl: "/dashboard/control-plane/iam",
      items: [
        { title: "Dashboard", url: "/dashboard/control-plane/iam", icon: <LayoutDashboardIcon /> },
        { title: "Users", url: "/dashboard/control-plane/iam/users", icon: <Users /> },
        { title: "Roles", url: "/dashboard/control-plane/iam/roles", icon: <Shield /> },
      ],
    },
    "/dashboard/control-plane/intergrations": {
      parentTitle: "Integrations Home",
      parentUrl: "/dashboard/control-plane/intergrations",
      items: [
        { title: "Dashboard", url: "/dashboard/control-plane/intergrations", icon: <LayoutDashboardIcon /> },
        { title: "Proxmox", url: "/dashboard/control-plane/intergrations/proxmox ", icon: <MailIcon /> },
        { title: "Unifi", url: "/dashboard/control-plane/intergrations/unifi", icon: <Database /> },
        { title: "Network", url: "/dashboard/control-plane/intergrations/network", icon: <NetworkIcon /> },
      ],
    },
  },
}

export function useNavigationConfig(): NavigationConfig {
  return React.useMemo(() => baseNavigationConfig, [])
}