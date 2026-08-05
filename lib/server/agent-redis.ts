import { createHash, randomBytes } from "crypto";

import { getRedisClient, getRedisEndpoint, isRedisConfigured } from "@/lib/redis";

const DEFAULT_PRESENCE_TTL_SEC = 90;
const DEFAULT_SESSION_TTL_SEC = 15 * 60;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAgentPresenceTtlSec() {
  return parsePositiveInt(process.env.AGENT_REDIS_PRESENCE_TTL_SEC, DEFAULT_PRESENCE_TTL_SEC);
}

function getAgentSessionTtlSec() {
  return parsePositiveInt(process.env.AGENT_REDIS_SESSION_TTL_SEC, DEFAULT_SESSION_TTL_SEC);
}

function getAgentRedisSessionMode() {
  const mode = process.env.AGENT_REDIS_SESSION_MODE?.trim().toLowerCase();
  if (mode === "shared" || mode === "acl") {
    return mode;
  }
  return "acl";
}

function getSharedAgentRedisCredentials() {
  const username = process.env.REDIS_AGENT_USERNAME?.trim() ?? "";
  const password = process.env.REDIS_AGENT_PASSWORD?.trim() ?? "";

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

function isAclNotAllowedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes("acl|setuser") || error.message.toLowerCase().includes("command 'acl");
}

export function getAgentRedisEventsChannel(organizationId: string) {
  return `org:${organizationId}:agent:events`;
}

export function getAgentRedisPresenceKey(organizationId: string, deviceId: string) {
  return `org:${organizationId}:agent:${deviceId}:presence`;
}

function getAgentRedisAclUsername(organizationId: string, deviceId: string) {
  const digest = createHash("sha256").update(`${organizationId}:${deviceId}`).digest("hex");
  return `agt_${digest.slice(0, 24)}`;
}

export type AgentRedisSessionResult = {
  endpoint: {
    host: string;
    port: number;
    tls: boolean;
    db: number;
  };
  username: string;
  password: string;
  expiresAt: string;
  presenceKey: string;
  eventsChannel: string;
  presenceTtlSec: number;
};

export async function issueAgentRedisSession(organizationId: string, deviceId: string) {
  if (!isRedisConfigured()) {
    throw new Error("Redis is not configured");
  }

  const redis = getRedisClient();
  const sessionTtlSec = getAgentSessionTtlSec();
  const presenceTtlSec = getAgentPresenceTtlSec();

  const eventsChannel = getAgentRedisEventsChannel(organizationId);
  const presenceKey = getAgentRedisPresenceKey(organizationId, deviceId);
  const expiresAt = new Date(Date.now() + sessionTtlSec * 1000).toISOString();

  const useSharedMode = getAgentRedisSessionMode() === "shared";
  const sharedCreds = getSharedAgentRedisCredentials();

  if (useSharedMode) {
    if (!sharedCreds) {
      throw new Error("Shared agent Redis credentials are not configured");
    }

    return {
      endpoint: getRedisEndpoint(),
      username: sharedCreds.username,
      password: sharedCreds.password,
      expiresAt,
      presenceKey,
      eventsChannel,
      presenceTtlSec,
    } satisfies AgentRedisSessionResult;
  }

  const username = getAgentRedisAclUsername(organizationId, deviceId);
  const password = randomBytes(24).toString("base64url");
  const keyPattern = `org:${organizationId}:agent:${deviceId}:*`;

  try {
    await redis.call(
      "ACL",
      "SETUSER",
      username,
      "on",
      "resetpass",
      `>${password}`,
      "resetkeys",
      `~${keyPattern}`,
      "resetchannels",
      `&${eventsChannel}`,
      "+PING",
      "+SET",
      "+PUBLISH",
    );
  } catch (error) {
    if (!isAclNotAllowedError(error) || !sharedCreds) {
      throw error;
    }

    return {
      endpoint: getRedisEndpoint(),
      username: sharedCreds.username,
      password: sharedCreds.password,
      expiresAt,
      presenceKey,
      eventsChannel,
      presenceTtlSec,
    } satisfies AgentRedisSessionResult;
  }

  await redis.set(
    `agent:redis:session:${organizationId}:${deviceId}`,
    JSON.stringify({ username, expiresAt }),
    "EX",
    sessionTtlSec,
  );

  return {
    endpoint: getRedisEndpoint(),
    username,
    password,
    expiresAt,
    presenceKey,
    eventsChannel,
    presenceTtlSec,
  } satisfies AgentRedisSessionResult;
}

export async function revokeAgentRedisSession(organizationId: string, deviceId: string) {
  if (!isRedisConfigured()) {
    return;
  }

  const redis = getRedisClient();

  if (getAgentRedisSessionMode() === "shared") {
    await redis.del(getAgentRedisPresenceKey(organizationId, deviceId));
    return;
  }

  const username = getAgentRedisAclUsername(organizationId, deviceId);

  await redis.call("ACL", "DELUSER", username).catch(() => null);
  await redis.del(
    `agent:redis:session:${organizationId}:${deviceId}`,
    getAgentRedisPresenceKey(organizationId, deviceId),
  );
}

type AgentHeartbeatProjection = {
  id: string;
  organizationId: string;
  deviceId: string;
  connected: boolean;
  lastSeen: Date | null;
  hostname: string | null;
  localIp: string | null;
  publicIp: string | null;
  version: string | null;
};

export async function publishAgentHeartbeatProjection(projection: AgentHeartbeatProjection) {
  if (!isRedisConfigured()) {
    return;
  }

  const redis = getRedisClient();
  const nowIso = new Date().toISOString();
  const presenceTtlSec = getAgentPresenceTtlSec();
  const presenceKey = getAgentRedisPresenceKey(projection.organizationId, projection.deviceId);
  const eventsChannel = getAgentRedisEventsChannel(projection.organizationId);

  const payload = {
    type: "agent.heartbeat",
    id: projection.id,
    organizationId: projection.organizationId,
    deviceId: projection.deviceId,
    connected: projection.connected,
    lastSeen: projection.lastSeen?.toISOString() ?? null,
    hostname: projection.hostname,
    localIp: projection.localIp,
    publicIp: projection.publicIp,
    version: projection.version,
    serverTime: nowIso,
  };

  await redis.set(presenceKey, JSON.stringify(payload), "EX", presenceTtlSec);
  await redis.publish(eventsChannel, JSON.stringify(payload));
}
