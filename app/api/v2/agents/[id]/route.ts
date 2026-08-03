import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";

const updateAgentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  hostname: z.string().min(1).max(255).optional(),
  platform: z.string().min(1).max(64).optional(),
  architecture: z.string().min(1).max(64).optional(),
  version: z.string().min(1).max(64).optional(),
  connected: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireDashboardSession();
  if (response) return response;

  const { id } = await params;

  const [entry] = await db.select().from(agent).where(eq(agent.id, id)).limit(1);

  if (!entry) {
    return jsonError("Agent not found", 404);
  }

  return NextResponse.json({ agent: entry });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireDashboardSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const parsed = updateAgentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const updates = parsed.data;

  if (Object.keys(updates).length === 0) {
    return jsonError("No fields provided for update", 400);
  }

  const [updated] = await db
    .update(agent)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(agent.id, id))
    .returning();

  if (!updated) {
    return jsonError("Agent not found", 404);
  }

  return NextResponse.json({ agent: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireDashboardSession();
  if (response) return response;

  const { id } = await params;

  const [deleted] = await db.delete(agent).where(eq(agent.id, id)).returning();

  if (!deleted) {
    return jsonError("Agent not found", 404);
  }

  return NextResponse.json({ success: true, id: deleted.id });
}
