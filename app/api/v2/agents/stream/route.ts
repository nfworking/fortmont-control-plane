import { desc } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import { requireDashboardSession } from "@/lib/server/agents";

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

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const publish = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const emitSnapshot = async () => {
        const items = await db.select().from(agent).orderBy(desc(agent.createdAt));
        publish("agents", { agents: toLiveState(items), serverTime: new Date().toISOString() });
      };

      publish("connected", { protocol: "sse", channel: "agents" });
      await emitSnapshot();

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        await emitSnapshot();
      }, 5000);

      request.signal.addEventListener("abort", () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
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
