"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command, ChevronsUpDown, Plus, Check, Loader2 } from "lucide-react"

import { NavMain } from "@/components/common/nav-main"
import { useNavigationConfig } from "@/lib/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"

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
  const [isPending, startTransition] = React.useTransition()
  const [switchingId, setSwitchingId] = React.useState<string | null>(null)

  const handleOrgChange = async (org: Organization) => {
    if (org.id === activeOrganization?.id) return

    setSwitchingId(org.id)
    try {
      await authClient.organization.setActive({
        organizationId: org.id,
      })

      window.dispatchEvent(
        new CustomEvent("organization-changed", {
          detail: { organizationId: org.id },
        })
      )

      startTransition(() => {
        router.refresh()
      })
    } finally {
      setSwitchingId(null)
    }
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      {...props}
      className="h-full border-r border-sidebar-border bg-sidebar rounded-r-xl overflow-hidden"
    >
      <SidebarHeader className="p-2 border-b border-sidebar-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="w-full justify-between gap-3 p-2 rounded-lg hover:bg-sidebar-accent/60 transition-all duration-200 ease-in-out data-[state=open]:bg-sidebar-accent"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Command className="size-4" />
                      )}
                    </div>
                    <div className="grid flex-1 text-left text-xs leading-tight truncate">
                      <span className="font-semibold truncate text-sidebar-foreground text-sm">
                        {activeOrganization?.name || "Fortmont Control"}
                      </span>
                      <span className="text-muted-foreground truncate text-[11px] capitalize">
                        {activeOrganization?.slug || "Personal Workspace"}
                      </span>
                    </div>
                  </div>
                  <ChevronsUpDown className="size-4 text-muted-foreground shrink-0 opacity-70 transition-opacity duration-150 group-hover:opacity-100" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl p-1.5 shadow-lg border-sidebar-border/60 bg-sidebar/95 backdrop-blur-md animate-in fade-in-80 zoom-in-95 duration-150"
                align="start"
                sideOffset={6}
              >
                <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                  Organizations
                </DropdownMenuLabel>

                <div className="space-y-0.5">
                  {organizations.map((org) => {
                    const isActive = org.id === activeOrganization?.id
                    const isSwitchingThis = switchingId === org.id

                    return (
                      <DropdownMenuItem
                        key={org.id}
                        onClick={() => handleOrgChange(org)}
                        className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors duration-150 hover:bg-sidebar-accent focus:bg-sidebar-accent"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground font-semibold text-[11px]">
                            {org.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{org.name}</span>
                        </div>

                        {isSwitchingThis ? (
                          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                        ) : isActive ? (
                          <Check className="size-3.5 text-primary" />
                        ) : null}
                      </DropdownMenuItem>
                    )
                  })}
                </div>

                <DropdownMenuSeparator className="my-1.5 bg-sidebar-border/50" />

                <DropdownMenuItem 
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:text-sidebar-foreground cursor-pointer transition-colors"
                  onClick={() => router.push("/organizations/new")}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border border-dashed border-sidebar-border">
                    <Plus className="size-3.5" />
                  </div>
                  <span>Create Organization</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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