import { NextRequest, NextResponse } from "next/server";

import { buildRequestAuditContext, recordAuditEvent } from "@/lib/server/audit";
import { jsonError } from "@/lib/server/agents";
import { registerAgentSchema, registerAgentWithToken } from "@/lib/server/agent-registry";
import { getRequestPublicIp } from "@/lib/server/request-ip";

export async function POST(request: NextRequest) {
  const requestAudit = buildRequestAuditContext(request);
  const body = await request.json().catch(() => null);
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
      ? "Agent registered via token endpoint"
      : "Agent reconnected via token endpoint",
  });

  return NextResponse.json({
    agent: result.agent,
    registered: result.registered,
    agentAuthToken: result.agentAuthToken,
  });
}
