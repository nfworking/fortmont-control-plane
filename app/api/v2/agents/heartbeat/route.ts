import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import { extractAgentAuthToken, requireAgentIdentity } from "@/lib/server/agent-auth";
import { jsonError } from "@/lib/server/agents";
import { getRequestPublicIp } from "@/lib/server/request-ip";

const heartbeatSchema = z.object({
  deviceId: z.string().min(3).max(255),
  version: z.string().min(1).max(64).optional(),
  hostname: z.string().min(1).max(255).optional(),
  localIp: z.string().max(64).optional().nullable(),
  publicIp: z.string().max(64).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = heartbeatSchema.safeParse(body);

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
      connected: true,
      lastSeen: now,
      updatedAt: now,
      hostname: parsed.data.hostname ?? existing.hostname,
      localIp: parsed.data.localIp ?? existing.localIp,
      publicIp: parsed.data.publicIp ?? requestPublicIp ?? existing.publicIp,
      version: parsed.data.version ?? existing.version,
      metadata: parsed.data.metadata ?? existing.metadata,
      authTokenLastUsedAt: now,
    })
    .where(eq(agent.id, existing.id))
    .returning();

  return NextResponse.json({
    ok: true,
    serverTime: now.toISOString(),
    agent: updated,
  });
}

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId") ?? undefined;

  if (!deviceId) {
    return jsonError("deviceId query parameter is required", 400);
  }

  const token = extractAgentAuthToken(request);
  const { agent: existing, response } = await requireAgentIdentity(deviceId, token);

  if (response || !existing) {
    return response;
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const publish = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const publishSnapshot = async () => {
        const [entry] = await db
          .select()
          .from(agent)
          .where(eq(agent.deviceId, deviceId))
          .limit(1);

        if (!entry) {
          publish("error", { message: "Agent not found", deviceId });
          return;
        }

        const activeSince = new Date(Date.now() - 90_000);
        const isLive = !!(
          entry.connected && entry.lastSeen && entry.lastSeen > activeSince
        );

        publish("heartbeat", {
          id: entry.id,
          deviceId: entry.deviceId,
          connected: isLive,
          lastSeen: entry.lastSeen,
          serverTime: new Date().toISOString(),
        });
      };

      publish("connected", {
        protocol: "sse",
        message: "Heartbeat stream established",
        deviceId,
      });

      await db
        .update(agent)
        .set({
          connected: true,
          lastSeen: new Date(),
          authTokenLastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agent.deviceId, deviceId));

      await publishSnapshot();

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        await db
          .update(agent)
          .set({
            connected: true,
            lastSeen: new Date(),
            authTokenLastUsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(agent.deviceId, deviceId));

        await publishSnapshot();
      }, 20_000);

      const disconnect = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        controller.close();
      };

      request.signal.addEventListener("abort", async () => {
        await db
          .update(agent)
          .set({
            connected: false,
            updatedAt: new Date(),
          })
          .where(eq(agent.deviceId, deviceId));

        disconnect();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
