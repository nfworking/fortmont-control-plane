import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db/drizzle";
import { member, user } from "@/db/schema";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import { getActiveOrganizationContext } from "@/server/orgs";

export async function GET() {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return jsonError("No active organization selected", 404);
  }

  const membership = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, orgContext.activeOrganization.id),
      eq(member.userId, session.user.id),
    ),
  });

  if (!membership) {
    return jsonError("Forbidden", 403);
  }

  const members = await db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgContext.activeOrganization.id))
    .orderBy(asc(user.name));

  return NextResponse.json({ members });
}
