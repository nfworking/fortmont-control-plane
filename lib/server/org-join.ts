import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db/drizzle";
import {
  member,
  organization,
  organizationJoinLink,
  organizationJoinRequest,
  user,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { generateJoinToken, hashJoinToken } from "@/lib/server/agents";

export type OrganizationJoinRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

function hasRole(roleValue: string | null | undefined, role: "owner" | "admin") {
  if (!roleValue) return false;

  return roleValue
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .includes(role);
}

async function hasMemberCreatePermission() {
  try {
    const result = (await auth.api.hasPermission({
      headers: await headers(),
      body: {
        permissions: {
          member: ["create"],
        },
      },
    })) as unknown;

    const payload = result as { success?: unknown; data?: unknown };

    if (typeof payload.success === "boolean") {
      return payload.success;
    }

    if (typeof payload.data === "boolean") {
      return payload.data;
    }

    if (
      payload.data &&
      typeof payload.data === "object" &&
      typeof (payload.data as { success?: unknown }).success === "boolean"
    ) {
      return Boolean((payload.data as { success?: unknown }).success);
    }

    return false;
  } catch {
    return false;
  }
}

export async function requireOrgJoinModerationPermission(
  organizationId: string,
  userId: string,
) {
  const permissionBasedAllowed = await hasMemberCreatePermission();
  if (permissionBasedAllowed) return true;

  const membership = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, organizationId),
      eq(member.userId, userId),
    ),
  });

  return hasRole(membership?.role, "owner") || hasRole(membership?.role, "admin");
}

export async function createOrRotateJoinLink(input: {
  organizationId: string;
  userId: string;
  label?: string | null;
}) {
  const now = new Date();

  await db
    .update(organizationJoinLink)
    .set({ enabled: false, updatedAt: now })
    .where(
      and(
        eq(organizationJoinLink.organizationId, input.organizationId),
        eq(organizationJoinLink.enabled, true),
      ),
    );

  const rawToken = generateJoinToken();
  const tokenHash = hashJoinToken(rawToken);

  const [created] = await db
    .insert(organizationJoinLink)
    .values({
      organizationId: input.organizationId,
      tokenHash,
      label: input.label ?? null,
      enabled: true,
      createdByUserId: input.userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    rawToken,
    link: created,
  };
}

export async function getCurrentJoinLink(organizationId: string) {
  const [link] = await db
    .select({
      id: organizationJoinLink.id,
      label: organizationJoinLink.label,
      enabled: organizationJoinLink.enabled,
      createdByUserId: organizationJoinLink.createdByUserId,
      createdAt: organizationJoinLink.createdAt,
      updatedAt: organizationJoinLink.updatedAt,
    })
    .from(organizationJoinLink)
    .where(eq(organizationJoinLink.organizationId, organizationId))
    .orderBy(desc(organizationJoinLink.createdAt))
    .limit(1);

  return link ?? null;
}

export async function setJoinLinkEnabled(input: {
  organizationId: string;
  enabled: boolean;
  linkId?: string | null;
}) {
  const target = input.linkId
    ? await db.query.organizationJoinLink.findFirst({
        where: and(
          eq(organizationJoinLink.id, input.linkId),
          eq(organizationJoinLink.organizationId, input.organizationId),
        ),
      })
    : await db.query.organizationJoinLink.findFirst({
        where: eq(organizationJoinLink.organizationId, input.organizationId),
        orderBy: [desc(organizationJoinLink.createdAt)],
      });

  if (!target) return null;

  const [updated] = await db
    .update(organizationJoinLink)
    .set({ enabled: input.enabled, updatedAt: new Date() })
    .where(
      and(
        eq(organizationJoinLink.id, target.id),
        eq(organizationJoinLink.organizationId, input.organizationId),
      ),
    )
    .returning();

  return updated ?? null;
}

export async function revokeJoinLink(organizationId: string, linkId?: string | null) {
  return setJoinLinkEnabled({
    organizationId,
    enabled: false,
    linkId,
  });
}

async function findLinkByRawToken(rawToken: string) {
  const tokenHash = hashJoinToken(rawToken);

  const [entry] = await db
    .select({
      id: organizationJoinLink.id,
      organizationId: organizationJoinLink.organizationId,
      enabled: organizationJoinLink.enabled,
      label: organizationJoinLink.label,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      organizationLogo: organization.logo,
    })
    .from(organizationJoinLink)
    .innerJoin(organization, eq(organization.id, organizationJoinLink.organizationId))
    .where(eq(organizationJoinLink.tokenHash, tokenHash))
    .limit(1);

  return entry ?? null;
}

export async function getJoinLinkOrgPreview(rawToken: string) {
  const entry = await findLinkByRawToken(rawToken);

  if (!entry || !entry.enabled) return null;

  return {
    joinLinkId: entry.id,
    organizationId: entry.organizationId,
    organizationName: entry.organizationName,
    organizationSlug: entry.organizationSlug,
    organizationLogo: entry.organizationLogo,
  };
}

export async function getJoinRequestStateForUser(
  organizationId: string,
  userId: string,
) {
  const [request] = await db
    .select({
      id: organizationJoinRequest.id,
      status: organizationJoinRequest.status,
      requestedAt: organizationJoinRequest.requestedAt,
      decidedAt: organizationJoinRequest.decidedAt,
      joinLinkId: organizationJoinRequest.joinLinkId,
    })
    .from(organizationJoinRequest)
    .where(
      and(
        eq(organizationJoinRequest.organizationId, organizationId),
        eq(organizationJoinRequest.userId, userId),
      ),
    )
    .orderBy(desc(organizationJoinRequest.requestedAt))
    .limit(1);

  return request ?? null;
}

export async function createJoinRequest(rawToken: string, userId: string) {
  const linkPreview = await getJoinLinkOrgPreview(rawToken);

  if (!linkPreview) {
    return {
      ok: false as const,
      status: 404,
      message: "Join link is invalid or revoked",
    };
  }

  const existingMembership = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, linkPreview.organizationId),
      eq(member.userId, userId),
    ),
  });

  if (existingMembership) {
    return {
      ok: false as const,
      status: 409,
      message: "User is already a member of this organization",
    };
  }

  const existingPending = await db.query.organizationJoinRequest.findFirst({
    where: and(
      eq(organizationJoinRequest.organizationId, linkPreview.organizationId),
      eq(organizationJoinRequest.userId, userId),
      eq(organizationJoinRequest.status, "pending"),
    ),
  });

  if (existingPending) {
    return {
      ok: true as const,
      created: false,
      request: existingPending,
      organizationId: linkPreview.organizationId,
    };
  }

  const now = new Date();
  const [created] = await db
    .insert(organizationJoinRequest)
    .values({
      organizationId: linkPreview.organizationId,
      userId,
      joinLinkId: linkPreview.joinLinkId,
      status: "pending",
      requestedAt: now,
      decidedAt: null,
      decidedByUserId: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    ok: true as const,
    created: true,
    request: created,
    organizationId: linkPreview.organizationId,
  };
}

export async function listJoinRequests(
  organizationId: string,
  status?: OrganizationJoinRequestStatus,
) {
  const filters = [eq(organizationJoinRequest.organizationId, organizationId)];

  if (status) {
    filters.push(eq(organizationJoinRequest.status, status));
  }

  return db
    .select({
      id: organizationJoinRequest.id,
      status: organizationJoinRequest.status,
      requestedAt: organizationJoinRequest.requestedAt,
      decidedAt: organizationJoinRequest.decidedAt,
      userId: organizationJoinRequest.userId,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      decidedByUserId: organizationJoinRequest.decidedByUserId,
    })
    .from(organizationJoinRequest)
    .innerJoin(user, eq(user.id, organizationJoinRequest.userId))
    .where(and(...filters))
    .orderBy(desc(organizationJoinRequest.requestedAt));
}

export async function decideJoinRequest(input: {
  requestId: string;
  organizationId: string;
  decision: "approve" | "reject";
  decidedByUserId: string;
}) {
  const [request] = await db
    .select()
    .from(organizationJoinRequest)
    .where(
      and(
        eq(organizationJoinRequest.id, input.requestId),
        eq(organizationJoinRequest.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!request) {
    return { ok: false as const, status: 404, message: "Join request not found" };
  }

  if (request.status !== "pending") {
    return { ok: false as const, status: 409, message: "Join request is not pending" };
  }

  const now = new Date();

  if (input.decision === "approve") {
    const alreadyMember = await db.query.member.findFirst({
      where: and(
        eq(member.organizationId, input.organizationId),
        eq(member.userId, request.userId),
      ),
    });

    if (!alreadyMember) {
      await auth.api.addMember({
        body: {
          userId: request.userId,
          organizationId: input.organizationId,
          role: "member",
        },
      });
    }
  }

  const [updated] = await db
    .update(organizationJoinRequest)
    .set({
      status: input.decision === "approve" ? "approved" : "rejected",
      decidedAt: now,
      decidedByUserId: input.decidedByUserId,
      updatedAt: now,
    })
    .where(eq(organizationJoinRequest.id, request.id))
    .returning();

  return {
    ok: true as const,
    request: updated,
  };
}
