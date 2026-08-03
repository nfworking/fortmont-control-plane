import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardPageProps = {
  children: ReactNode;
  className?: string;
};

type DashboardHeroProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

type DashboardSectionProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DashboardPage({ children, className }: DashboardPageProps) {
  return (
    <main className={cn("flex flex-1 flex-col gap-6 px-4 py-4 md:px-6 md:py-6", className)}>
      {children}
    </main>
  );
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  badge,
  actions,
  className,
}: DashboardHeroProps) {
  return (
    <section className={cn("rounded-2xl border border-border/60 bg-card/90 p-6 shadow-sm backdrop-blur-sm", className)}>
      <div className="flex flex-row gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {title}
          </h1>
          {description ? (
            <div className="max-w-2xl text-sm text-muted-foreground md:text-base">
              {description}
            </div>
          ) : null}
        </div>

        {(badge || actions) ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {badge}
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function DashboardSection({
  title,
  description,
  actions,
  children,
  className,
}: DashboardSectionProps) {
  return (
    <section className={cn("rounded-2xl border border-border/60 bg-card/90 p-6 shadow-sm backdrop-blur-sm", className)}>
      <div className="mb-4 flex flex-row gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {description ? (
            <div className="text-sm text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {children}
    </section>
  );
}