import { desc, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import { createRedisSubscriber, isRedisConfigured } from "@/lib/redis";
import { getAgentRedisEventsChannel } from "@/lib/server/agent-redis";
import { requireDashboardSession } from "@/lib/server/agents";
import { getActiveOrganizationContext } from "@/server/orgs";

function toLiveState(items: Array<typeof agent.$inferSelect>) {
  const now = Date.now();
  const activeWindowMs = 90_000;

  return items.map((entry) => {
    const lastSeenMs = entry.lastSeen ? new Date(entry.lastSeen).getTime() : 0;

    return {
      ...entry,
      connected: entry.connected && lastSeenMs > 0 && now - lastSeenMs <= activeWindowMs,
    };
  });
}

export async function GET(request: Request) {
  const { response } = await requireDashboardSession();
  if (response) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return new Response(JSON.stringify({ error: "No active organization selected" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const publish = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const emitSnapshot = async () => {
        const items = await db
          .select()
          .from(agent)
          .where(eq(agent.organizationId, orgContext.activeOrganization!.id))
          .orderBy(desc(agent.createdAt));
        publish("agents", { agents: toLiveState(items), serverTime: new Date().toISOString() });
      };

      publish("connected", { protocol: "sse", channel: "agents" });
      await emitSnapshot();

      let interval: NodeJS.Timeout | null = null;
      let keepAlive: NodeJS.Timeout | null = null;
      let subscriber: ReturnType<typeof createRedisSubscriber> | null = null;
      let cleanupSubscription: (() => Promise<void>) | null = null;

      if (isRedisConfigured()) {
        const channel = getAgentRedisEventsChannel(orgContext.activeOrganization!.id);
        subscriber = createRedisSubscriber();

        await subscriber.connect().catch(() => null);
        await subscriber.subscribe(channel);

        const onMessage = async (incomingChannel: string) => {
          if (closed || incomingChannel !== channel) return;
          await emitSnapshot();
        };

        subscriber.on("message", onMessage);

        keepAlive = setInterval(() => {
          if (closed) return;
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        }, 25_000);

        cleanupSubscription = async () => {
          subscriber?.off("message", onMessage);
          await subscriber?.unsubscribe(channel).catch(() => null);
          await subscriber?.quit().catch(() => null);
        };
      } else {
        interval = setInterval(async () => {
          if (closed) {
            if (interval) {
              clearInterval(interval);
            }
            return;
          }

          await emitSnapshot();
        }, 5000);
      }

      request.signal.addEventListener("abort", async () => {
        if (closed) return;
        closed = true;
        if (interval) {
          clearInterval(interval);
        }
        if (keepAlive) {
          clearInterval(keepAlive);
        }
        if (cleanupSubscription) {
          await cleanupSubscription();
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
