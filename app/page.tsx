import Link from "next/link";

import { getActiveOrganizationContext } from "@/server/orgs";

export default async function Home() {
  const orgContext = await getActiveOrganizationContext();
  const activeOrganization = orgContext.activeOrganization;
  const organizationName = activeOrganization?.name ?? "No organization selected";
  const organizationId = activeOrganization?.id ?? "None";

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 rounded-xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Fortmont Control Plane
        </p>
        <h1 className="text-3xl font-semibold">Welcome</h1>
        <p className="text-muted-foreground">
          This home screen shows the active organization context before you open the dashboard.
        </p>

        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium">Active organization</p>
          <p className="text-lg font-semibold">{organizationName}</p>
          <p className="mt-2 text-sm text-muted-foreground">Organization ID: {organizationId}</p>
        </div>

        <Link
          href="/dashboard/control-plane"
          className="inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Open dashboard
        </Link>
      </div>
    </main>
  );
}
