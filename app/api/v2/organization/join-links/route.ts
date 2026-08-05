import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildRequestAuditContext, recordAuditEvent } from "@/lib/server/audit";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import {
  createOrRotateJoinLink,
  getCurrentJoinLink,
  requireOrgJoinModerationPermission,
  revokeJoinLink,
  setJoinLinkEnabled,
} from "@/lib/server/org-join";
import { getActiveOrganizationContext } from "@/server/orgs";

const createJoinLinkSchema = z.object({
  label: z.string().max(120).optional().nullable(),
});

const setJoinLinkEnabledSchema = z.object({
  enabled: z.boolean(),
  linkId: z.string().uuid().optional().nullable(),
});

function resolveJoinBaseOrigin(request: NextRequest) {
  const configuredBaseUrl =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    null;

  if (configuredBaseUrl) {
    try {
      return new URL(configuredBaseUrl).origin;
    } catch {
    }
  }

  return request.nextUrl.origin;
}

async function requireOrgModerator() {
  const { session, response } = await requireDashboardSession();
  if (response || !session) {
    return { ok: false as const, response };
  }

  const orgContext = await getActiveOrganizationContext();
  if (!orgContext.activeOrganization?.id) {
    return { ok: false as const, response: jsonError("No active organization selected", 404) };
  }

  const allowed = await requireOrgJoinModerationPermission(
    orgContext.activeOrganization.id,
    session.user.id,
  );

  if (!allowed) {
    return { ok: false as const, response: jsonError("Forbidden", 403) };
  }

  return {
    ok: true as const,
    session,
    organizationId: orgContext.activeOrganization.id,
  };
}

export async function GET() {
  const guard = await requireOrgModerator();
  if (!guard.ok) return guard.response;

  const link = await getCurrentJoinLink(guard.organizationId);
  return NextResponse.json({ link });
}

export async function POST(request: NextRequest) {
  const guard = await requireOrgModerator();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = createJoinLinkSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const created = await createOrRotateJoinLink({
    organizationId: guard.organizationId,
    userId: guard.session.user.id,
    label: parsed.data.label ?? null,
  });
  const joinBaseOrigin = resolveJoinBaseOrigin(request);
  const joinUrl = `${joinBaseOrigin}/join/${encodeURIComponent(created.rawToken)}`;

  const requestAudit = buildRequestAuditContext(request);
  await recordAuditEvent({
    organizationId: guard.organizationId,
    category: "organization",
    action: "organization.join_link.rotate",
    outcome: "success",
    actorType: "user",
    userId: guard.session.user.id,
    actorEmail: guard.session.user.email,
    ipAddress: requestAudit.ipAddress,
    userAgent: requestAudit.userAgent,
    targetType: "organization_join_link",
    targetId: created.link.id,
    message: "Created/rotated organization join link",
    metadata: {
      organizationId: guard.organizationId,
      label: created.link.label,
      enabled: created.link.enabled,
    },
  });

  return NextResponse.json(
    {
      token: created.rawToken,
      joinUrl,
      link: {
        id: created.link.id,
        label: created.link.label,
        enabled: created.link.enabled,
        createdAt: created.link.createdAt,
      },
    },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const guard = await requireOrgModerator();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = setJoinLinkEnabledSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const updated = await setJoinLinkEnabled({
    organizationId: guard.organizationId,
    enabled: parsed.data.enabled,
    linkId: parsed.data.linkId ?? null,
  });

  if (!updated) {
    return jsonError("Join link not found", 404);
  }

  return NextResponse.json({
    link: {
      id: updated.id,
      label: updated.label,
      enabled: updated.enabled,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireOrgModerator();
  if (!guard.ok) return guard.response;

  const linkId = request.nextUrl.searchParams.get("linkId");
  const revoked = await revokeJoinLink(guard.organizationId, linkId);

  if (!revoked) {
    return jsonError("Join link not found", 404);
  }

  return NextResponse.json({
    success: true,
    id: revoked.id,
  });
}
