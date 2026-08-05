import { NextResponse } from "next/server";
import { escapeFluxTagValue, influxBucket, influxClient, influxOrg } from "@/lib/influx";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import { getActiveOrganizationContext } from "@/server/orgs";

export async function GET() {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const escapedOrganizationId = escapeFluxTagValue(orgContext.activeOrganization.id);

  const query = `
    from(bucket: "${influxBucket}")
      |> range(start: -24h)
      |> filter(fn: (r) => r["_field"] == "usage_percent")
      |> filter(fn: (r) => r["organizationId"] == "${escapedOrganizationId}")
      |> keep(columns: ["deviceId"])
      |> group()
      |> distinct(column: "deviceId")
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