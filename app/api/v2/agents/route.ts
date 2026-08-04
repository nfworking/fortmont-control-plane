import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import {
  buildRequestAuditContext,
  recordAuditEvent,
} from "@/lib/server/audit";
import {
  jsonError,
  requireDashboardSession,
} from "@/lib/server/agents";
import {
  createAgentSchema,
  normalizeMetadata,
  registerAgentSchema,
  registerAgentWithToken,
} from "@/lib/server/agent-registry";
import { getRequestPublicIp } from "@/lib/server/request-ip";
import { getActiveOrganizationContext } from "@/server/orgs";

async function listAgents(organizationId: string) {
  const agents = await db
    .select()
    .from(agent)
    .where(eq(agent.organizationId, organizationId))
    .orderBy(desc(agent.createdAt));

  const now = Date.now();
  const activeWindowMs = 90_000;

  return agents.map((entry) => {
    const lastSeenMs = entry.lastSeen ? new Date(entry.lastSeen).getTime() : 0;
    const computedConnected = lastSeenMs > 0 && now - lastSeenMs <= activeWindowMs;

    return {
      ...entry,
      connected: entry.connected && computedConnected,
    };
  });
}

export async function GET() {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const agents = await listAgents(orgContext.activeOrganization.id);

  return NextResponse.json({ agents });
}

export async function POST(request: NextRequest) {
  const requestAudit = buildRequestAuditContext(request);
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid JSON body", 400);
  }

  const organizationId = typeof body.organizationId === "string" ? body.organizationId : null;

  if ("joinToken" in body) {
    const parsed = registerAgentSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
    }

    const result = await registerAgentWithToken({
      ...parsed.data,
      publicIp: parsed.data.publicIp ?? getRequestPublicIp(request.headers),
    });

    if (!result.ok) {
      await recordAuditEvent({
        category: "agent",
        action: "agent.register_with_token",
        outcome: "failure",
        actorType: "unknown",
        deviceId: parsed.data.deviceId,
        ipAddress: requestAudit.ipAddress,
        userAgent: requestAudit.userAgent,
        targetType: "agent",
        targetId: parsed.data.deviceId,
        message: result.message,
      });
      return jsonError(result.message, result.status);
    }

    await recordAuditEvent({
      category: "agent",
      action: result.registered ? "agent.register" : "agent.reconnect",
      outcome: "success",
      actorType: "agent",
      agentId: result.agent.id,
      deviceId: result.agent.deviceId,
      ipAddress: requestAudit.ipAddress,
      userAgent: requestAudit.userAgent,
      targetType: "agent",
      targetId: result.agent.id,
      message: result.registered
        ? "Agent registered via join token"
        : "Agent reconnected via join token",
      metadata: {
        platform: result.agent.platform,
        hostname: result.agent.hostname,
      },
    });

    return NextResponse.json({
      agent: result.agent,
      registered: result.registered,
      agentAuthToken: result.agentAuthToken,
    });
  }

  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  const resolvedOrganizationId = organizationId ?? orgContext.activeOrganization?.id ?? null;
  if (!resolvedOrganizationId) {
    return jsonError("No active organization selected", 404);
  }

  const parsed = createAgentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const [existing] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.deviceId, parsed.data.deviceId), eq(agent.organizationId, resolvedOrganizationId)))
    .limit(1);

  if (existing) {
    return jsonError("An agent with this deviceId already exists", 409);
  }

  const now = new Date();

  const [created] = await db
    .insert(agent)
    .values({
      ...parsed.data,
      organizationId: resolvedOrganizationId,
      description: parsed.data.description ?? null,
      localIp: parsed.data.localIp ?? null,
      publicIp: parsed.data.publicIp ?? getRequestPublicIp(request.headers),
      metadata: normalizeMetadata(parsed.data.metadata),
      connected: false,
      lastSeen: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await recordAuditEvent({
    category: "agent",
    action: "agent.create",
    outcome: "success",
    actorType: "user",
    userId: session.user.id,
    actorEmail: session.user.email,
    agentId: created.id,
    deviceId: created.deviceId,
    ipAddress: requestAudit.ipAddress,
    userAgent: requestAudit.userAgent,
    targetType: "agent",
    targetId: created.id,
    message: "Agent created from dashboard API",
    metadata: {
      hostname: created.hostname,
      platform: created.platform,
      architecture: created.architecture,
    },
  });

  return NextResponse.json({ agent: created }, { status: 201 });
}
