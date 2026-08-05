import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { agent, auditLog, user } from "@/db/schema";
import { getRequestPublicIp } from "@/lib/server/request-ip";

type JsonMap = Record<string, unknown>;

export type AuditOutcome = "success" | "failure" | "denied" | "info";
export type AuditActorType = "user" | "agent" | "system" | "unknown";

export type AuditEventInput = {
  organizationId?: string | null;
  category: string;
  action: string;
  outcome?: AuditOutcome;
  actorType?: AuditActorType;
  userId?: string | null;
  actorEmail?: string | null;
  agentId?: string | null;
  deviceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  message?: string | null;
  metadata?: JsonMap | null;
};

export async function recordAuditEvent(input: AuditEventInput) {
  try {
    await db.insert(auditLog).values({
      organizationId: input.organizationId ?? null,
      category: input.category,
      action: input.action,
      outcome: input.outcome ?? "info",
      actorType: input.actorType ?? "unknown",
      userId: input.userId ?? null,
      actorEmail: input.actorEmail ?? null,
      agentId: input.agentId ?? null,
      deviceId: input.deviceId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      message: input.message ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to write audit event", error);
  }
}

export function buildRequestAuditContext(request: Request) {
  return {
    ipAddress: getRequestPublicIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  };
}

export async function getUserByEmail(email: string) {
  const [entry] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  return entry ?? null;
}

export async function getAgentByDeviceId(deviceId: string) {
  const [entry] = await db
    .select({ id: agent.id, deviceId: agent.deviceId, name: agent.name })
    .from(agent)
    .where(eq(agent.deviceId, deviceId))
    .limit(1);

  return entry ?? null;
}

export const auditListOrder = desc(auditLog.createdAt);

export function extractEmailFromUnknown(body: unknown) {
  if (!body || typeof body !== "object") return null;

  const email = (body as { email?: unknown }).email;
  if (typeof email === "string" && email.trim()) {
    return email.trim().toLowerCase();
  }

  return null;
}

export function coerceLimit(value: string | null, fallback = 50, max = 200) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function ilikeContains(column: any, value: string | null) {
  if (!value) return undefined;
  const q = value.trim();
  if (!q) return undefined;
  return sql`${column} ILIKE ${`%${q}%`}`;
}
