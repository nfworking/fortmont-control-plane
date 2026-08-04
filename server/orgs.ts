"use server";

import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db/drizzle";
import { member, organization } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentUser } from "./users";

export async function getOrganizationsForUser(userId: string) {
  const members = await db.query.member.findMany({
    where: eq(member.userId, userId),
  });

  if (!members.length) {
    return [];
  }

  return db.query.organization.findMany({
    where: inArray(
      organization.id,
      members.map((item) => item.organizationId),
    ),
  });
}

export async function getOrganizations() {
  const { currentUser } = await getCurrentUser();
  return getOrganizationsForUser(currentUser.id);
}

export async function getActiveOrganizationContext() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return {
      session: null,
      currentUser: null,
      organizations: [],
      activeOrganization: null,
      activeOrganizationId: null,
    };
  }

  const organizations = await getOrganizationsForUser(session.user.id);
  const activeOrganizationId = session.session?.activeOrganizationId ?? null;
  const activeOrganization = activeOrganizationId
    ? organizations.find((org) => org.id === activeOrganizationId) ?? null
    : organizations[0] ?? null;

  return {
    session,
    currentUser: session.user,
    organizations,
    activeOrganization,
    activeOrganizationId: activeOrganization?.id ?? null,
  };
}

export async function getActiveOrganization(userId?: string) {
  if (userId) {
    const organizations = await getOrganizationsForUser(userId);
    const session = await auth.api.getSession({ headers: await headers() });
    const activeOrganizationId = session?.session?.activeOrganizationId ?? null;

    return activeOrganizationId
      ? organizations.find((org) => org.id === activeOrganizationId) ?? null
      : organizations[0] ?? null;
  }

  const context = await getActiveOrganizationContext();
  return context.activeOrganization;
}

export async function getOrganizationBySlug(slug: string) {
  try {
    const organizationBySlug = await db.query.organization.findFirst({
      where: eq(organization.slug, slug),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });

    return organizationBySlug;
  } catch (error) {
    console.error(error);
    return null;
  }
}