import { NextResponse } from "next/server";

import { requireDashboardSession } from "@/lib/server/agents";
import { getActiveOrganizationContext } from "@/server/orgs";

export async function GET() {
  const { response } = await requireDashboardSession();
  if (response) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return NextResponse.json({ organization: null }, { status: 404 });
  }

  return NextResponse.json({
    organization: {
      id: orgContext.activeOrganization.id,
      name: orgContext.activeOrganization.name,
      slug: orgContext.activeOrganization.slug,
    },
  });
}
