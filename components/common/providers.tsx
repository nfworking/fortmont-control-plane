"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";

import { ThemeProvider } from "@/components/ui/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import {SessionGuard} from "./session-guard";

type ProvidersProps = {
  children: React.ReactNode;
  session: Parameters<typeof SessionProvider>[0]["session"];
};

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <SessionGuard />
      <TooltipProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Toaster richColors closeButton />
          {children}
        </ThemeProvider>
      </TooltipProvider>
    </SessionProvider>
  );
}