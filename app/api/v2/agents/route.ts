import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
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

async function listAgents() {
  const agents = await db
    .select()
    .from(agent)
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
  const { response } = await requireDashboardSession();
  if (response) return response;

  const agents = await listAgents();

  return NextResponse.json({ agents });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid JSON body", 400);
  }

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
      return jsonError(result.message, result.status);
    }

    return NextResponse.json({
      agent: result.agent,
      registered: result.registered,
      agentAuthToken: result.agentAuthToken,
    });
  }

  const { response } = await requireDashboardSession();
  if (response) return response;

  const parsed = createAgentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const [existing] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(eq(agent.deviceId, parsed.data.deviceId))
    .limit(1);

  if (existing) {
    return jsonError("An agent with this deviceId already exists", 409);
  }

  const now = new Date();

  const [created] = await db
    .insert(agent)
    .values({
      ...parsed.data,
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

  return NextResponse.json({ agent: created }, { status: 201 });
}
