// components/section-cards.tsx
"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Boxes, RefreshCw, Server, Container, Cpu, HardDrive } from "lucide-react";
import { withBearerToken } from "@/lib/fetch-auth";

// ── Types ────────────────────────────────────────────────────────────────

type ApiResourceEntry = {
  type: string;
  cpu: number;
  vmid: string;
  id: string;
  name: string;
  status: string;
  mem: number;
  maxmem: number;
  disk: number;
};

interface SectionCardsProps {
  title?: string;
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function bytesToGB(bytes: number) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}


export function SectionCards({ title = "Proxmox Resources", className }: SectionCardsProps) {
  const { data: session } = useSession();
  const [resources, setResources] = useState<ApiResourceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_HOST}/api/proxmox/resources`,
        withBearerToken(undefined, session?.accessToken),
      );
      if (!res.ok) {
        setResources([]);
        return;
      }
      const json = await res.json();
      setResources(Array.isArray(json.data) ? json.data : []);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [load]);

  const totalResources = resources.length;

  const countsByType = resources.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalStorageUsed = resources.reduce((acc, r) => acc + (r.disk || 0), 0);

  const rows = [
    { id: "total", label: "Total Resources", value: totalResources, icon: Boxes },
    { id: "lxc", label: "LXC Containers", value: countsByType.lxc || 0, icon: Container },
    { id: "qemu", label: "VMs (QEMU)", value: countsByType.qemu || 0, icon: Cpu },
    { id: "disk", label: "Total Disk Usage", value: `${bytesToGB(totalStorageUsed)} GB`, icon: HardDrive },
  ];

  return (
    <Card className={cn("w-full max-w-sm border-border/60 bg-background/80 shadow-sm backdrop-blur-sm", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="size-4 text-muted-foreground" />
          <CardTitle className="text-40px font-medium">{title}</CardTitle>
        </div>
        <CardDescription className="text-xs">
          {loading
            ? "Loading resource inventory…"
            : totalResources === 0
              ? "No resources found"
              : `${totalResources} resource${totalResources === 1 ? "" : "s"} across the cluster`}
        </CardDescription>
        <CardAction className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
            {loading ? "Syncing" : "Live"}
          </Badge>
          <button
            onClick={load}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Refresh resources"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="divide-y divide-border/50 rounded-lg border border-border/50 bg-background/40">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2.5">
                <row.icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-foreground/90">{row.label}</span>
              </div>
              <span className="shrink-0 font-mono text-[12px] text-foreground">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default SectionCards;