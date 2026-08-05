import { and, eq, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/drizzle";
import { agent, auditLog, user } from "@/db/schema";
import { coerceLimit } from "@/lib/server/audit";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import { getActiveOrganizationContext } from "@/server/orgs";

export async function GET(request: NextRequest) {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const activeOrganizationId = orgContext.activeOrganization.id;

  const category = request.nextUrl.searchParams.get("category");
  const action = request.nextUrl.searchParams.get("action");
  const outcome = request.nextUrl.searchParams.get("outcome");
  const actorType = request.nextUrl.searchParams.get("actorType");
  const userId = request.nextUrl.searchParams.get("userId");
  const deviceId = request.nextUrl.searchParams.get("deviceId");
  const search = request.nextUrl.searchParams.get("search");
  const limit = coerceLimit(request.nextUrl.searchParams.get("limit"), 50, 200);

  const filters = [
    eq(auditLog.organizationId, activeOrganizationId),
    category ? eq(auditLog.category, category) : undefined,
    action ? eq(auditLog.action, action) : undefined,
    outcome ? eq(auditLog.outcome, outcome) : undefined,
    actorType ? eq(auditLog.actorType, actorType) : undefined,
    userId ? eq(auditLog.userId, userId) : undefined,
    deviceId ? eq(auditLog.deviceId, deviceId) : undefined,
    search
      ? or(
          sql`${auditLog.message} ILIKE ${`%${search}%`}`,
          sql`${auditLog.action} ILIKE ${`%${search}%`}`,
          sql`${auditLog.category} ILIKE ${`%${search}%`}`,
          sql`${auditLog.actorEmail} ILIKE ${`%${search}%`}`,
          sql`${auditLog.deviceId} ILIKE ${`%${search}%`}`,
        )
      : undefined,
  ].filter(Boolean);

  const items = await db
    .select({
      id: auditLog.id,
      organizationId: auditLog.organizationId,
      createdAt: auditLog.createdAt,
      category: auditLog.category,
      action: auditLog.action,
      outcome: auditLog.outcome,
      actorType: auditLog.actorType,
      userId: auditLog.userId,
      actorEmail: auditLog.actorEmail,
      agentId: auditLog.agentId,
      deviceId: auditLog.deviceId,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      message: auditLog.message,
      metadata: auditLog.metadata,
      userName: user.name,
      userEmail: user.email,
      agentName: agent.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.userId, user.id))
    .leftJoin(agent, eq(auditLog.agentId, agent.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(sql`${auditLog.createdAt} DESC`)
    .limit(limit);

  return NextResponse.json({ items, count: items.length });
}
