import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildRequestAuditContext, recordAuditEvent } from "@/lib/server/audit";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import { decideJoinRequest, requireOrgJoinModerationPermission } from "@/lib/server/org-join";
import { getActiveOrganizationContext } from "@/server/orgs";

const decideSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const body = await request.json().catch(() => null);
  const parsed = decideSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const { id } = await params;
  const result = await decideJoinRequest({
    requestId: id,
    organizationId: orgContext.activeOrganization.id,
    decision: parsed.data.decision,
    decidedByUserId: session.user.id,
  });

  if (!result.ok) {
    return jsonError(result.message, result.status);
  }

  const requestAudit = buildRequestAuditContext(request);
  await recordAuditEvent({
    organizationId: orgContext.activeOrganization.id,
    category: "organization",
    action:
      parsed.data.decision === "approve"
        ? "organization.join_request.approve"
        : "organization.join_request.reject",
    outcome: "success",
    actorType: "user",
    userId: session.user.id,
    actorEmail: session.user.email,
    ipAddress: requestAudit.ipAddress,
    userAgent: requestAudit.userAgent,
    targetType: "organization_join_request",
    targetId: result.request?.id,
    message:
      parsed.data.decision === "approve"
        ? "Approved organization join request"
        : "Rejected organization join request",
    metadata: {
      organizationId: orgContext.activeOrganization.id,
      requestId: result.request?.id,
      requestedUserId: result.request?.userId,
    },
  });

  return NextResponse.json({ request: result.request });
}
