import { NextRequest, NextResponse } from "next/server";

import { buildRequestAuditContext, recordAuditEvent } from "@/lib/server/audit";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import { createJoinRequest } from "@/lib/server/org-join";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const { token } = await params;
  const joinToken = decodeURIComponent(token);

  const created = await createJoinRequest(joinToken, session.user.id);
  if (!created.ok) {
    return jsonError(created.message, created.status);
  }

  const requestAudit = buildRequestAuditContext(request);
  await recordAuditEvent({
    organizationId: created.organizationId,
    category: "organization",
    action: "organization.join_request.submit",
    outcome: "success",
    actorType: "user",
    userId: session.user.id,
    actorEmail: session.user.email,
    ipAddress: requestAudit.ipAddress,
    userAgent: requestAudit.userAgent,
    targetType: "organization_join_request",
    targetId: created.request.id,
    message: "Submitted organization join request",
    metadata: {
      organizationId: created.organizationId,
      created: created.created,
    },
  });

  return NextResponse.json(
    {
      request: created.request,
      created: created.created,
    },
    { status: created.created ? 201 : 200 },
  );
}
