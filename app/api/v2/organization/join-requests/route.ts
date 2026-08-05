import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import {
  listJoinRequests,
  OrganizationJoinRequestStatus,
  requireOrgJoinModerationPermission,
} from "@/lib/server/org-join";
import { getActiveOrganizationContext } from "@/server/orgs";

const statusSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);

export async function GET(request: NextRequest) {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const allowed = await requireOrgJoinModerationPermission(
    orgContext.activeOrganization.id,
    session.user.id,
  );

  if (!allowed) {
    return jsonError("Forbidden", 403);
  }

  const statusInput = request.nextUrl.searchParams.get("status");
  const parsedStatus = statusInput ? statusSchema.safeParse(statusInput) : null;

  if (statusInput && !parsedStatus?.success) {
    return jsonError("Invalid status filter", 400);
  }

  const requests = await listJoinRequests(
    orgContext.activeOrganization.id,
    parsedStatus?.success ? (parsedStatus.data as OrganizationJoinRequestStatus) : undefined,
  );

  return NextResponse.json({ requests });
}
