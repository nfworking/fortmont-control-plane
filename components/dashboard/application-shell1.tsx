"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "@/components/common/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type ApplicationShell1Props = {
  className?: string;
  children: ReactNode;
};

const DASHBOARD_TITLES: Array<{ path: string; title: string }> = [
  { path: "/dashboard/control-plane/agents", title: "Agents" },
  { path: "/dashboard/control-plane/server", title: "API Server" },
  { path: "/dashboard/control-plane", title: "Control Plane" },
  { path: "/dashboard/server-settings", title: "Server settings" },
  { path: "/dashboard/server-registry", title: "Server Registry" },
  { path: "/dashboard/lxc-registry", title: "LXC Registry" },
  { path: "/dashboard/certs", title: "SSL Certificates" },
  { path: "/dashboard/dns", title: "DNS Records" },
  { path: "/dashboard/users", title: "Site Users" },
  { path: "/dashboard/proxy", title: "Proxy" },
  { path: "/dashboard", title: "Dashboard" },
];

function getDashboardTitle(pathname: string) {
  const match = DASHBOARD_TITLES.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );

  return match?.title ?? "Dashboard";
}

export function ApplicationShell1({ className, children }: ApplicationShell1Props) {
  const pathname = usePathname();
  const title = getDashboardTitle(pathname);

  return (
    <SidebarProvider
      className={cn(className, "bg-background text-foreground")}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" className="bg-background text-foreground" />
      <SidebarInset className="bg-background text-foreground">
        <SiteHeader title={title} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
