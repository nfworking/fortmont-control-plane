import { InfluxDB } from "@influxdata/influxdb-client";

const url = process.env.INFLUX_URL || "";
const token = process.env.INFLUX_TOKEN || "";

export const influxOrg = process.env.INFLUX_ORG || "";
export const influxBucket = process.env.INFLUX_BUCKET || "system_metrics";

export const influxClient = new InfluxDB({ url, token });

const ALLOWED_HISTORY_RANGES = new Set(["1h", "6h", "24h"]);

export function resolveMetricsHistoryRange(value: string | null) {
	if (value && ALLOWED_HISTORY_RANGES.has(value)) {
		return value;
	}

	return "1h";
}

export function escapeFluxTagValue(value: string) {
	return value.replace(/\\/g, "\\\\").replace(/\"/g, '\\\"');
}