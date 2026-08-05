import { Point } from "@influxdata/influxdb-client";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { agent } from "@/db/schema";

import { influxBucket, influxClient, influxOrg } from "@/lib/influx";
import { extractAgentAuthToken, requireAgentIdentity } from "@/lib/server/agent-auth";
import { jsonError } from "@/lib/server/agents";

// Match payload structure produced by the Go metrics collector
const metricsSchema = z.object({
  deviceId: z.string().min(3).max(255),
  metrics: z.object({
    timestamp: z.number(),
    cpu: z.object({
      usagePercent: z.number(),
      cores: z.number(),
    }),
    memory: z.object({
      totalBytes: z.number(),
      usedBytes: z.number(),
      freeBytes: z.number(),
      usagePercent: z.number(),
    }),
    storage: z.object({
      path: z.string(),
      totalBytes: z.number(),
      usedBytes: z.number(),
      freeBytes: z.number(),
      usagePercent: z.number(),
    }),
  }),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = metricsSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid metrics payload", 400);
  }

  const { deviceId, metrics } = parsed.data;

  // 1. Authenticate agent against Drizzle relational state
  const token = extractAgentAuthToken(request);
  const { agent: existing, response } = await requireAgentIdentity(deviceId, token);

  if (response || !existing) {
    return response;
  }

  const now = new Date();

  try {
    // 2. Prepare InfluxDB Write API
    const writeApi = influxClient.getWriteApi(influxOrg, influxBucket, "ms");

    // Point tags let us quickly filter queries by device ID, host, or OS platform
    const baseTags = {
      organizationId: existing.organizationId,
      deviceId: existing.deviceId,
      hostname: existing.hostname ?? "unknown",
      platform: existing.platform ?? "unknown",
    };

    // --- CPU Metric Point ---
    const cpuPoint = new Point("cpu_metrics")
      .timestamp(metrics.timestamp * 1000) // Convert Unix timestamp seconds -> ms
      .floatField("usage_percent", metrics.cpu.usagePercent)
      .intField("cores", metrics.cpu.cores);

    Object.entries(baseTags).forEach(([k, v]) => cpuPoint.tag(k, v));

    // --- Memory Metric Point ---
    const memPoint = new Point("memory_metrics")
      .timestamp(metrics.timestamp * 1000)
      .floatField("usage_percent", metrics.memory.usagePercent)
      .intField("total_bytes", metrics.memory.totalBytes)
      .intField("used_bytes", metrics.memory.usedBytes)
      .intField("free_bytes", metrics.memory.freeBytes);

    Object.entries(baseTags).forEach(([k, v]) => memPoint.tag(k, v));

    // --- Storage Metric Point ---
    const storagePoint = new Point("storage_metrics")
      .timestamp(metrics.timestamp * 1000)
      .tag("mount_path", metrics.storage.path)
      .floatField("usage_percent", metrics.storage.usagePercent)
      .intField("total_bytes", metrics.storage.totalBytes)
      .intField("used_bytes", metrics.storage.usedBytes)
      .intField("free_bytes", metrics.storage.freeBytes);

    Object.entries(baseTags).forEach(([k, v]) => storagePoint.tag(k, v));

    // 3. Write points to buffer and flush
    writeApi.writePoints([cpuPoint, memPoint, storagePoint]);
    await writeApi.close();

    // 4. Update core DB table to register activity timestamp
    await db
      .update(agent)
      .set({
        connected: true,
        lastSeen: now,
        authTokenLastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(agent.id, existing.id));

    return NextResponse.json({
      ok: true,
      writtenAt: now.toISOString(),
    });
  } catch (err: any) {
    console.error("InfluxDB write failed:", err);
    return jsonError("Failed to persist metric snapshot", 500);
  }
}