import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import { publishAgentHeartbeatProjection, revokeAgentRedisSession } from "@/lib/server/agent-redis";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import { getActiveOrganizationContext } from "@/server/orgs";

const updateAgentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  hostname: z.string().min(1).max(255).optional(),
  platform: z.string().min(1).max(64).optional(),
  architecture: z.string().min(1).max(64).optional(),
  version: z.string().min(1).max(64).optional(),
  connected: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireDashboardSession();
  if (response) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const { id } = await params;
  const [entry] = await db.select().from(agent).where(and(eq(agent.id, id), eq(agent.organizationId, orgContext.activeOrganization.id))).limit(1);

  if (!entry) {
    return jsonError("Agent not found", 404);
  }

  return NextResponse.json({ agent: entry });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireDashboardSession();
  if (response) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateAgentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return jsonError("No fields provided for update", 400);
  }

  const [updated] = await db.update(agent).set({ ...updates, updatedAt: new Date() }).where(and(eq(agent.id, id), eq(agent.organizationId, orgContext.activeOrganization.id))).returning();

  if (!updated) {
    return jsonError("Agent not found", 404);
  }

  return NextResponse.json({ agent: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireDashboardSession();
  if (response) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const { id } = await params;
  const [deleted] = await db.delete(agent).where(and(eq(agent.id, id), eq(agent.organizationId, orgContext.activeOrganization.id))).returning();

  if (!deleted) {
    return jsonError("Agent not found", 404);
  }

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

  return NextResponse.json({ success: true, id: deleted.id });
}
