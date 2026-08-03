import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { agent, agentJoinToken } from "@/db/schema";
import { generateAgentAuthToken, hashAgentAuthToken } from "@/lib/server/agent-auth";
import { hashJoinToken } from "@/lib/server/agents";

export const registerAgentSchema = z.object({
  joinToken: z.string().min(8),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  deviceId: z.string().min(3).max(255),
  hostname: z.string().min(1).max(255),
  platform: z.string().min(1).max(64),
  architecture: z.string().min(1).max(64),
  version: z.string().min(1).max(64),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const createAgentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  deviceId: z.string().min(3).max(255),
  hostname: z.string().min(1).max(255),
  platform: z.string().min(1).max(64),
  architecture: z.string().min(1).max(64),
  version: z.string().min(1).max(64),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export function normalizeMetadata(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  return value ?? null;
}

export async function registerAgentWithToken(data: z.infer<typeof registerAgentSchema>) {
  const now = new Date();
  const agentAuthToken = generateAgentAuthToken();
  const agentAuthTokenHash = hashAgentAuthToken(agentAuthToken);
  const tokenHash = hashJoinToken(data.joinToken);

  const [token] = await db
    .select()
    .from(agentJoinToken)
    .where(
      and(
        eq(agentJoinToken.tokenHash, tokenHash),
        eq(agentJoinToken.revoked, false),
        gt(agentJoinToken.expiresAt, now),
      ),
    )
    .limit(1);

  if (!token) {
    return { ok: false as const, status: 401, message: "Join token is invalid or expired" };
  }

  if (token.usesCount >= token.maxUses) {
    return { ok: false as const, status: 401, message: "Join token has reached its usage limit" };
  }

  const [existing] = await db
    .select()
    .from(agent)
    .where(eq(agent.deviceId, data.deviceId))
    .limit(1);

  const payload = {
    name: data.name,
    description: data.description ?? null,
    deviceId: data.deviceId,
    hostname: data.hostname,
    platform: data.platform,
    architecture: data.architecture,
    version: data.version,
    metadata: normalizeMetadata(data.metadata),
    authTokenHash: agentAuthTokenHash,
    authTokenIssuedAt: now,
    authTokenLastUsedAt: now,
    connected: true,
    lastSeen: now,
    updatedAt: now,
  };

  const [upsertedAgent] = existing
    ? await db.update(agent).set(payload).where(eq(agent.id, existing.id)).returning()
    : await db
        .insert(agent)
        .values({
          ...payload,
          createdAt: now,
        })
        .returning();

  await db
    .update(agentJoinToken)
    .set({
      usesCount: sql`${agentJoinToken.usesCount} + 1`,
      updatedAt: now,
    })
    .where(eq(agentJoinToken.id, token.id));

  return {
    ok: true as const,
    agent: upsertedAgent,
    registered: !existing,
    agentAuthToken,
  };
}
