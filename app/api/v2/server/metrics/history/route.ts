import { NextRequest, NextResponse } from "next/server";
import {
  escapeFluxTagValue,
  influxBucket,
  influxClient,
  influxOrg,
  resolveMetricsHistoryRange,
} from "@/lib/influx";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import { getActiveOrganizationContext } from "@/server/orgs";

export async function GET(request: NextRequest) {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const activeOrganizationId = orgContext.activeOrganization.id;
  const { searchParams } = new URL(request.url);
  const range = resolveMetricsHistoryRange(searchParams.get("range"));
  const deviceId = searchParams.get("deviceId")?.trim() || null;

  // Determine window aggregate size based on timeframe
  const aggregateWindow = range === "24h" ? "15m" : range === "6h" ? "5m" : "1m";

  const escapedOrganizationId = escapeFluxTagValue(activeOrganizationId);
  const escapedDeviceId = deviceId ? escapeFluxTagValue(deviceId) : null;

  // Flux query to fetch downsampled historical time-series data
  const query = `
    from(bucket: "${influxBucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r["_field"] == "usage_percent")
      |> filter(fn: (r) => r["organizationId"] == "${escapedOrganizationId}")
      ${escapedDeviceId ? `|> filter(fn: (r) => r["deviceId"] == "${escapedDeviceId}")` : ""}
      |> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)
      |> yield(name: "mean")
  `;

  try {
    const queryApi = influxClient.getQueryApi(influxOrg);
    const dataMap: Record<string, { time: string; timestamp: number; cpu?: number; memory?: number; storage?: number }> = {};

    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          const rawTime = o._time;
          if (!rawTime) return;

          const formattedTime = new Date(rawTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          if (!dataMap[rawTime]) {
            dataMap[rawTime] = {
              time: formattedTime,
              timestamp: new Date(rawTime).getTime(),
            };
          }

          const val = Math.round(Number(o._value || 0) * 10) / 10;

          if (o._measurement === "cpu_metrics") {
            dataMap[rawTime].cpu = val;
          } else if (o._measurement === "memory_metrics") {
            dataMap[rawTime].memory = val;
          } else if (o._measurement === "storage_metrics") {
            dataMap[rawTime].storage = val;
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

    // Sort entries chronologically
    const timeSeries = Object.values(dataMap).sort((a, b) => a.timestamp - b.timestamp);

    return NextResponse.json({
      ok: true,
      range,
      data: timeSeries,
    });
  } catch (err: any) {
    console.error("Failed to query historical metrics from InfluxDB:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to read historical telemetry from InfluxDB" },
      { status: 500 }
    );
  }
}