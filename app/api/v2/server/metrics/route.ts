import { NextRequest, NextResponse } from "next/server";
import { influxBucket, influxClient, influxOrg } from "@/lib/influx";

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId");

  // Flux query to fetch latest CPU, Memory, and Storage metrics over the last 5 minutes
  const query = `
    from(bucket: "${influxBucket}")
      |> range(start: -5m)
      |> filter(fn: (r) => r["_field"] == "usage_percent")
      ${deviceId ? `|> filter(fn: (r) => r["deviceId"] == "${deviceId}")` : ""}
      |> last()
  `;

  try {
    const queryApi = influxClient.getQueryApi(influxOrg);
    
    let cpuPercent = 0;
    let memPercent = 0;
    let storagePercent = 0;
    let activeDeviceId = deviceId || "all";
    let lastSeenTimestamp = new Date().toISOString();

    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          if (o._measurement === "cpu_metrics") {
            cpuPercent = Number(o._value) || 0;
          } else if (o._measurement === "memory_metrics") {
            memPercent = Number(o._value) || 0;
          } else if (o._measurement === "storage_metrics") {
            storagePercent = Number(o._value) || 0;
          }
          if (o.deviceId) {
            activeDeviceId = o.deviceId;
          }
          if (o._time) {
            lastSeenTimestamp = o._time;
          }
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve();
        },
      });
    });

    return NextResponse.json({
      ok: true,
      deviceId: activeDeviceId,
      timestamp: lastSeenTimestamp,
      metrics: {
        cpuUsagePercent: Math.round(cpuPercent * 10) / 10,
        memoryUsagePercent: Math.round(memPercent * 10) / 10,
        storageUsagePercent: Math.round(storagePercent * 10) / 10,
      },
    });
  } catch (err: any) {
    console.error("Failed to query InfluxDB dashboard metrics:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to read telemetry from InfluxDB" },
      { status: 500 }
    );
  }
}