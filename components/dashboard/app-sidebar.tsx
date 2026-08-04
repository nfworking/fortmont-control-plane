"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { NavMain } from "@/components/common/nav-main"
import { useNavigationConfig } from "@/lib/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Command } from "lucide-react"
import { authClient } from "@/lib/auth-client" // Adjust path to your auth client

type Organization = {
  id: string
  name: string
  slug: string
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: {
    name?: string | null
    email?: string | null
    avatar?: string | null
  } | null
  organizations?: Organization[]
  activeOrganization?: Organization | null
}

export function AppSidebar({ 
  user, 
  organizations = [], 
  activeOrganization, 
  ...props 
}: AppSidebarProps) {
  const navigationConfig = useNavigationConfig()
  const router = useRouter()

  const handleOrgChange = async (orgSlug: string) => {
    const selectedOrg = organizations.find((org) => org.slug === orgSlug)
    if (!selectedOrg) return

    await authClient.organization.setActive({
      organizationId: selectedOrg.id,
    })

    window.dispatchEvent(new CustomEvent("organization-changed", { detail: { organizationId: selectedOrg.id } }))

    // Refresh server components / route data after switching
    router.refresh()
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      {...props}
      className="h-full border-r border-sidebar-border bg-sidebar rounded-r-xl overflow-hidden"
    >
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <Select 
              defaultValue={activeOrganization?.slug} 
              onValueChange={handleOrgChange}
            >
              <SelectTrigger className="w-full h-auto p-2 flex items-center justify-start gap-3 bg-transparent border-none shadow-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:ring-0">
                <div className="flex aspect-square size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0">
                  <Command className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 text-left leading-none truncate">
                  <SelectValue placeholder="Select Organization">
                    <span className="text-sm font-semibold text-sidebar-foreground truncate block">
                      {activeOrganization?.name || "Fortmont Control Plane"}
                    </span>
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Organizations</SelectLabel>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.slug}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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