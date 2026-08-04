import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import { buildRequestAuditContext, recordAuditEvent } from "@/lib/server/audit";
import { extractAgentAuthToken, requireAgentIdentity } from "@/lib/server/agent-auth";
import { jsonError } from "@/lib/server/agents";
import { getRequestPublicIp } from "@/lib/server/request-ip";

const connectSchema = z.object({
  deviceId: z.string().min(3).max(255),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  hostname: z.string().min(1).max(255).optional(),
  localIp: z.string().max(64).optional().nullable(),
  publicIp: z.string().max(64).optional().nullable(),
  platform: z.string().min(1).max(64).optional(),
  architecture: z.string().min(1).max(64).optional(),
  version: z.string().min(1).max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const requestAudit = buildRequestAuditContext(request);
  const body = await request.json().catch(() => null);
  const parsed = connectSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const token = extractAgentAuthToken(request);
  const { agent: existing, response } = await requireAgentIdentity(parsed.data.deviceId, token);

  if (response || !existing) {
    return response;
  }

  const now = new Date();
  const requestPublicIp = getRequestPublicIp(request.headers);

  const [updated] = await db
    .update(agent)
    .set({
      name: parsed.data.name ?? existing.name,
      description: parsed.data.description ?? existing.description,
      hostname: parsed.data.hostname ?? existing.hostname,
      localIp: parsed.data.localIp ?? existing.localIp,
      publicIp: parsed.data.publicIp ?? requestPublicIp ?? existing.publicIp,
      platform: parsed.data.platform ?? existing.platform,
      architecture: parsed.data.architecture ?? existing.architecture,
      version: parsed.data.version ?? existing.version,
      metadata: parsed.data.metadata ?? existing.metadata,
      connected: true,
      lastSeen: now,
      authTokenLastUsedAt: now,
      updatedAt: now,
    })
    .where(eq(agent.id, existing.id))
    .returning();

  await recordAuditEvent({
    category: "agent",
    action: "agent.connect",
    outcome: "success",
    actorType: "agent",
    agentId: updated.id,
    deviceId: updated.deviceId,
    ipAddress: requestAudit.ipAddress,
    userAgent: requestAudit.userAgent,
    targetType: "agent",
    targetId: updated.id,
    message: "Agent connected and updated profile",
  });

  return NextResponse.json({
    ok: true,
    connected: true,
    agent: updated,
  });
}
