import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/server/agents";
import { registerAgentSchema, registerAgentWithToken } from "@/lib/server/agent-registry";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerAgentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const result = await registerAgentWithToken(parsed.data);

  if (!result.ok) {
    return jsonError(result.message, result.status);
  }

  return NextResponse.json({
    agent: result.agent,
    registered: result.registered,
    agentAuthToken: result.agentAuthToken,
  });
}
