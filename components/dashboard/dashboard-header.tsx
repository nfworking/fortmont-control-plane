"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "@/server/users";

export function DashboardHeader() {
  const [userName, setUserName] = useState<string | null>(null);

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  useEffect(() => {
    async function loadUser() {
      const data = await getCurrentUser();
      setUserName(data.user?.name ?? null);
    }
    loadUser();
  }, []); // Empty array ensures this fires only once on mount

  return (
    <header className="flex flex-col gap-1 border-b border-border pb-5">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        Welcome Back, {userName} 👋
      </h1>
      <p className="font-mono text-sm text-muted-foreground">{dateLabel}</p>
    </header>
  );
}