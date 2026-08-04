import { NextResponse } from "next/server";
import { influxBucket, influxClient, influxOrg } from "@/lib/influx";

export async function GET() {
  const query = `
    import "influxdata/influxdata/schema"
    schema.tagValues(
      bucket: "${influxBucket}",
      tag: "deviceId",
      start: -24h
    )
  `;

  try {
    const queryApi = influxClient.getQueryApi(influxOrg);
    const devices: string[] = [];

    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          if (o._value) devices.push(o._value);
        },
        error(err) {
          reject(err);
        },
        complete() {
          resolve();
        },
      });
    });

    return NextResponse.json({ ok: true, devices });
  } catch (err) {
    return NextResponse.json({ ok: false, devices: [] }, { status: 500 });
  }
}