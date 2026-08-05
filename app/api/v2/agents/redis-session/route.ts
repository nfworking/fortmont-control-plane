import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { extractAgentAuthToken, requireAgentIdentity } from "@/lib/server/agent-auth";
import { issueAgentRedisSession } from "@/lib/server/agent-redis";
import { jsonError } from "@/lib/server/agents";

const redisSessionSchema = z.object({
  deviceId: z.string().min(3).max(255),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = redisSessionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const token = extractAgentAuthToken(request);
  const { agent: existing, response } = await requireAgentIdentity(parsed.data.deviceId, token);

  if (response || !existing) {
    return response;
  }

  try {
    const session = await issueAgentRedisSession(existing.organizationId, existing.deviceId);

    return NextResponse.json({
      ok: true,
      session,
    });
  } catch (error) {
    console.error("failed to issue agent redis session", error);
    return jsonError("Redis session is unavailable", 503);
  }
}
