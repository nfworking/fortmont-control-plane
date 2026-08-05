import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/db/drizzle";
import { member } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getJoinLinkOrgPreview, getJoinRequestStateForUser } from "@/lib/server/org-join";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const joinToken = decodeURIComponent(token);

  const preview = await getJoinLinkOrgPreview(joinToken);
  if (!preview) {
    return NextResponse.json({ error: "Join link not found" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({
      organization: {
        id: preview.organizationId,
        name: preview.organizationName,
        slug: preview.organizationSlug,
        logo: preview.organizationLogo,
      },
      authRequired: true,
    });
  }

  const existingMembership = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, preview.organizationId),
      eq(member.userId, session.user.id),
    ),
  });

  const latestRequest = await getJoinRequestStateForUser(
    preview.organizationId,
    session.user.id,
  );

  return NextResponse.json({
    organization: {
      id: preview.organizationId,
      name: preview.organizationName,
      slug: preview.organizationSlug,
      logo: preview.organizationLogo,
    },
    authRequired: false,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    membership: existingMembership
      ? {
          id: existingMembership.id,
          role: existingMembership.role,
        }
      : null,
    request: latestRequest,
  });
}
