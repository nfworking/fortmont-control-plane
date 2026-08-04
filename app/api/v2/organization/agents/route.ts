import { and, desc, eq, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/drizzle";
import { agent, agentJoinToken } from "@/db/schema";
import { buildRequestAuditContext, recordAuditEvent } from "@/lib/server/audit";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import { getActiveOrganizationContext } from "@/server/orgs";

export async function GET() {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const agents = await db
    .select()
    .from(agent)
    .where(eq(agent.organizationId, orgContext.activeOrganization.id))
    .orderBy(desc(agent.createdAt));

  return NextResponse.json({ agents });
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
  if (!body || typeof body !== "object") {
    return jsonError("Invalid JSON body", 400);
  }

  const name = typeof body.name === "string" ? body.name : "";
  const description = typeof body.description === "string" ? body.description : null;
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const hostname = typeof body.hostname === "string" ? body.hostname : "";
  const platform = typeof body.platform === "string" ? body.platform : "";
  const architecture = typeof body.architecture === "string" ? body.architecture : "";
  const version = typeof body.version === "string" ? body.version : "";
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : null;

  if (!name || !deviceId || !hostname || !platform || !architecture || !version) {
    return jsonError("Invalid agent payload", 400);
  }

  const [existing] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.deviceId, deviceId), eq(agent.organizationId, orgContext.activeOrganization.id)))
    .limit(1);

  if (existing) {
    return jsonError("An agent with this deviceId already exists", 409);
  }

  const now = new Date();
  const [created] = await db
    .insert(agent)
    .values({
      organizationId: orgContext.activeOrganization.id,
      name,
      description,
      deviceId,
      hostname,
      localIp: typeof body.localIp === "string" ? body.localIp : null,
      publicIp: typeof body.publicIp === "string" ? body.publicIp : null,
      platform,
      architecture,
      version,
      metadata,
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
      organizationId: orgContext.activeOrganization.id,
      hostname: created.hostname,
      platform: created.platform,
      architecture: created.architecture,
    },
  });

  return NextResponse.json({ agent: created }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const agentId = request.nextUrl.searchParams.get("id");
  if (!agentId) {
    return jsonError("id query parameter is required", 400);
  }

  const [deleted] = await db
    .delete(agent)
    .where(and(eq(agent.id, agentId), eq(agent.organizationId, orgContext.activeOrganization.id)))
    .returning();

  if (!deleted) {
    return jsonError("Agent not found", 404);
  }

  return NextResponse.json({ success: true, id: deleted.id });
}
