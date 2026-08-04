import { InfluxDB } from "@influxdata/influxdb-client";

const url = process.env.INFLUX_URL || "";
const token = process.env.INFLUX_TOKEN || "";

export const influxOrg = process.env.INFLUX_ORG || "";
export const influxBucket = process.env.INFLUX_BUCKET || "system_metrics";

export const influxClient = new InfluxDB({ url, token });