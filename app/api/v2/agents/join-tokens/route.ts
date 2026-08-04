import { and, desc, eq, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { agentJoinToken } from "@/db/schema";
import { buildRequestAuditContext, recordAuditEvent } from "@/lib/server/audit";
import {
  generateJoinToken,
  hashJoinToken,
  jsonError,
  requireDashboardSession,
} from "@/lib/server/agents";
import { getActiveOrganizationContext } from "@/server/orgs";

const createJoinTokenSchema = z.object({
  label: z.string().max(120).optional().nullable(),
  maxUses: z.number().int().min(1).max(1000).default(1),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(24),
});

export async function GET() {
  const { response } = await requireDashboardSession();
  if (response) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const now = new Date();

  const tokens = await db
    .select({
      id: agentJoinToken.id,
      label: agentJoinToken.label,
      maxUses: agentJoinToken.maxUses,
      usesCount: agentJoinToken.usesCount,
      revoked: agentJoinToken.revoked,
      expiresAt: agentJoinToken.expiresAt,
      createdAt: agentJoinToken.createdAt,
      updatedAt: agentJoinToken.updatedAt,
      createdByUserId: agentJoinToken.createdByUserId,
    })
    .from(agentJoinToken)
    .where(
      and(
        eq(agentJoinToken.organizationId, orgContext.activeOrganization.id),
        eq(agentJoinToken.revoked, false),
        gt(agentJoinToken.expiresAt, now),
      ),
    )
    .orderBy(desc(agentJoinToken.createdAt));

  return NextResponse.json({ tokens });
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const requestAudit = buildRequestAuditContext(request);

  const body = await request.json().catch(() => null);
  const parsed = createJoinTokenSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + parsed.data.expiresInHours * 60 * 60 * 1000);
  const joinToken = generateJoinToken();
  const tokenHash = hashJoinToken(joinToken);

  const [created] = await db
    .insert(agentJoinToken)
    .values({
      organizationId: orgContext.activeOrganization.id,
      tokenHash,
      label: parsed.data.label ?? null,
      maxUses: parsed.data.maxUses,
      usesCount: 0,
      revoked: false,
      expiresAt,
      createdByUserId: session.user.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: agentJoinToken.id,
      label: agentJoinToken.label,
      maxUses: agentJoinToken.maxUses,
      usesCount: agentJoinToken.usesCount,
      revoked: agentJoinToken.revoked,
      expiresAt: agentJoinToken.expiresAt,
      createdAt: agentJoinToken.createdAt,
      createdByUserId: agentJoinToken.createdByUserId,
    });

  await recordAuditEvent({
    category: "agent",
    action: "agent.join_token.create",
    outcome: "success",
    actorType: "user",
    userId: session.user.id,
    actorEmail: session.user.email,
    ipAddress: requestAudit.ipAddress,
    userAgent: requestAudit.userAgent,
    targetType: "agent_join_token",
    targetId: created.id,
    message: "Created agent join token",
    metadata: {
      label: created.label,
      maxUses: created.maxUses,
      expiresAt: created.expiresAt,
    },
  });

  return NextResponse.json(
    {
      token: joinToken,
      tokenInfo: created,
    },
    { status: 201 },
  );
}

export async function DELETE(request: NextRequest) {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const requestAudit = buildRequestAuditContext(request);

  const tokenId = request.nextUrl.searchParams.get("tokenId");

  if (!tokenId) {
    return jsonError("tokenId query parameter is required", 400);
  }

  const [revoked] = await db
    .update(agentJoinToken)
    .set({
      revoked: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agentJoinToken.id, tokenId),
        eq(agentJoinToken.organizationId, orgContext.activeOrganization.id),
      ),
    )
    .returning({ id: agentJoinToken.id });

  if (!revoked) {
    return jsonError("Join token not found", 404);
  }

  await recordAuditEvent({
    category: "agent",
    action: "agent.join_token.revoke",
    outcome: "success",
    actorType: "user",
    userId: session.user.id,
    actorEmail: session.user.email,
    ipAddress: requestAudit.ipAddress,
    userAgent: requestAudit.userAgent,
    targetType: "agent_join_token",
    targetId: revoked.id,
    message: "Revoked agent join token",
  });

  return NextResponse.json({ success: true, id: revoked.id });
}
