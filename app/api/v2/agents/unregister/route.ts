import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import { extractAgentAuthToken, requireAgentIdentity } from "@/lib/server/agent-auth";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";

const unregisterSchema = z.object({
  deviceId: z.string().min(3).max(255).optional(),
  id: z.string().uuid().optional(),
  hardDelete: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = unregisterSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const { deviceId, id, hardDelete } = parsed.data;

  if (!deviceId && !id) {
    return jsonError("Either id or deviceId must be provided", 400);
  }

  if (hardDelete || id) {
    const { response } = await requireDashboardSession();
    if (response) return response;
  }

  if (deviceId && !hardDelete && !id) {
    const token = extractAgentAuthToken(request);
    const { response } = await requireAgentIdentity(deviceId, token);
    if (response) return response;
  }

  const whereClause = id ? eq(agent.id, id) : eq(agent.deviceId, deviceId!);

  if (hardDelete) {
    const [deleted] = await db.delete(agent).where(whereClause).returning();

    if (!deleted) {
      return jsonError("Agent not found", 404);
    }

    return NextResponse.json({ success: true, removed: true, id: deleted.id });
  }

  const [updated] = await db
    .update(agent)
    .set({
      connected: false,
      updatedAt: new Date(),
    })
    .where(whereClause)
    .returning();

  if (!updated) {
    return jsonError("Agent not found", 404);
  }

  return NextResponse.json({ success: true, removed: false, agent: updated });
}
