import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import { buildRequestAuditContext, recordAuditEvent } from "@/lib/server/audit";
import { extractAgentAuthToken, requireAgentIdentity } from "@/lib/server/agent-auth";
import { publishAgentHeartbeatProjection, revokeAgentRedisSession } from "@/lib/server/agent-redis";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";

const unregisterSchema = z.object({
  deviceId: z.string().min(3).max(255).optional(),
  id: z.string().uuid().optional(),
  hardDelete: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const requestAudit = buildRequestAuditContext(request);
  let dashboardUserId: string | null = null;
  let dashboardUserEmail: string | null = null;

  const body = await request.json().catch(() => null);
  const parsed = unregisterSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const { deviceId, id, hardDelete } = parsed.data;

  if (!deviceId && !id) {
    return jsonError("Either id or deviceId must be provided", 400);
  }

  if (hardDelete || id) {
    const { session, response } = await requireDashboardSession();
    if (response || !session) return response;
    dashboardUserId = session.user.id;
    dashboardUserEmail = session.user.email;
  }

  if (deviceId && !hardDelete && !id) {
    const token = extractAgentAuthToken(request);
    const { response } = await requireAgentIdentity(deviceId, token);
    if (response) return response;
  }

  const whereClause = id ? eq(agent.id, id) : eq(agent.deviceId, deviceId!);

  if (hardDelete) {
    const [deleted] = await db.delete(agent).where(whereClause).returning();

    if (!deleted) {
      return jsonError("Agent not found", 404);
    }

    await recordAuditEvent({
      organizationId: deleted.organizationId,
      category: "agent",
      action: "agent.delete",
      outcome: "success",
      actorType: "user",
      userId: dashboardUserId,
      actorEmail: dashboardUserEmail,
      agentId: deleted.id,
      deviceId: deleted.deviceId,
      ipAddress: requestAudit.ipAddress,
      userAgent: requestAudit.userAgent,
      targetType: "agent",
      targetId: deleted.id,
      message: "Agent hard deleted",
    });

    await publishAgentHeartbeatProjection({
      id: deleted.id,
      organizationId: deleted.organizationId,
      deviceId: deleted.deviceId,
      connected: false,
      lastSeen: deleted.lastSeen,
      hostname: deleted.hostname,
      localIp: deleted.localIp,
      publicIp: deleted.publicIp,
      version: deleted.version,
    }).catch((error) => {
      console.error("failed to publish disconnect projection", error);
    });

    await revokeAgentRedisSession(deleted.organizationId, deleted.deviceId).catch((error) => {
      console.error("failed to revoke redis session", error);
    });

    return NextResponse.json({ success: true, removed: true, id: deleted.id });
  }

  const [updated] = await db
    .update(agent)
    .set({
      connected: false,
      updatedAt: new Date(),
    })
    .where(whereClause)
    .returning();

  if (!updated) {
    return jsonError("Agent not found", 404);
  }

  await recordAuditEvent({
    organizationId: updated.organizationId,
    category: "agent",
    action: "agent.unregister",
    outcome: "success",
    actorType: id || hardDelete ? "user" : "agent",
    userId: dashboardUserId,
    actorEmail: dashboardUserEmail,
    agentId: updated.id,
    deviceId: updated.deviceId,
    ipAddress: requestAudit.ipAddress,
    userAgent: requestAudit.userAgent,
    targetType: "agent",
    targetId: updated.id,
    message: "Agent marked disconnected",
  });

  await publishAgentHeartbeatProjection({
    id: updated.id,
    organizationId: updated.organizationId,
    deviceId: updated.deviceId,
    connected: false,
    lastSeen: updated.lastSeen,
    hostname: updated.hostname,
    localIp: updated.localIp,
    publicIp: updated.publicIp,
    version: updated.version,
  }).catch((error) => {
    console.error("failed to publish disconnect projection", error);
  });

  await revokeAgentRedisSession(updated.organizationId, updated.deviceId).catch((error) => {
    console.error("failed to revoke redis session", error);
  });

  return NextResponse.json({ success: true, removed: false, agent: updated });
}
