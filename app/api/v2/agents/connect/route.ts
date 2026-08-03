import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import { extractAgentAuthToken, requireAgentIdentity } from "@/lib/server/agent-auth";
import { jsonError } from "@/lib/server/agents";

const connectSchema = z.object({
  deviceId: z.string().min(3).max(255),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  hostname: z.string().min(1).max(255).optional(),
  platform: z.string().min(1).max(64).optional(),
  architecture: z.string().min(1).max(64).optional(),
  version: z.string().min(1).max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(request: NextRequest) {
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

  const [updated] = await db
    .update(agent)
    .set({
      name: parsed.data.name ?? existing.name,
      description: parsed.data.description ?? existing.description,
      hostname: parsed.data.hostname ?? existing.hostname,
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

  return NextResponse.json({
    ok: true,
    connected: true,
    agent: updated,
  });
}
