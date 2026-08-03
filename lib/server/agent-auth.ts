import { createHash, randomBytes } from "crypto";

import { and, eq } from "drizzle-orm";

type RequestWithHeaders = {
  headers: Headers;
};

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";
import { jsonError } from "@/lib/server/agents";

export function generateAgentAuthToken() {
  return `agt_auth_${randomBytes(24).toString("hex")}`;
}

export function hashAgentAuthToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function extractAgentAuthToken(request: RequestWithHeaders) {
  const authHeader = request.headers.get("authorization")?.trim();

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const headerToken = request.headers.get("x-agent-token")?.trim();
  if (headerToken) return headerToken;

  return null;
}

export async function requireAgentIdentity(deviceId: string, rawToken: string | null) {
  if (!rawToken) {
    return {
      agent: null,
      response: jsonError("Missing agent token", 401),
    };
  }

  const tokenHash = hashAgentAuthToken(rawToken);

  const [entry] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.deviceId, deviceId), eq(agent.authTokenHash, tokenHash)))
    .limit(1);

  if (!entry) {
    return {
      agent: null,
      response: jsonError("Invalid agent token", 401),
    };
  }

  return {
    agent: entry,
    response: null,
  };
}
