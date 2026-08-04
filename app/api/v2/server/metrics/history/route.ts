import { NextRequest, NextResponse } from "next/server";
import { influxBucket, influxClient, influxOrg } from "@/lib/influx";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "1h"; // 1h, 6h, 24h
  const deviceId = searchParams.get("deviceId");

  // Determine aggregate window based on timeframe
  const aggregateWindow = range === "24h" ? "15m" : range === "6h" ? "5m" : "1m";

  // createEmpty: true ensures InfluxDB generates timestamped rows for gaps in data
  const query = `
    from(bucket: "${influxBucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r["_field"] == "usage_percent")
      ${deviceId ? `|> filter(fn: (r) => r["deviceId"] == "${deviceId}")` : ""}
      |> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: true)
      |> yield(name: "mean")
  `;

  try {
    const queryApi = influxClient.getQueryApi(influxOrg);
    const dataMap: Record<
      string,
      { time: string; timestamp: number; cpu: number | null; memory: number | null; storage: number | null }
    > = {};

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
              cpu: null,
              memory: null,
              storage: null,
            };
          }

          // If Influx value exists, round it; if null/undefined, keep as null to trigger chart gap
          const val = o._value !== null && o._value !== undefined
            ? Math.round(Number(o._value) * 10) / 10
            : null;

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