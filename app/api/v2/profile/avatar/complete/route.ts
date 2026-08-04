import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { user } from "@/db/schema";
import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import {
  assertAvatarObject,
  deleteAvatarObjectByUrl,
  getAvatarLimits,
  getAvatarPublicUrl,
  isAllowedAvatarContentType,
} from "@/lib/server/r2";

const completeSchema = z.object({
  key: z.string().min(1).max(1024),
  contentType: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const body = await request.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const contentType = parsed.data.contentType.toLowerCase();
  if (!isAllowedAvatarContentType(contentType)) {
    return jsonError("Unsupported file type. Allowed: JPG, PNG, GIF, WEBP", 400);
  }

  const keyPrefix = `users/${session.user.id}/avatar/`;
  if (!parsed.data.key.startsWith(keyPrefix)) {
    return jsonError("Invalid object key", 400);
  }

  const { maxBytes } = getAvatarLimits();

  try {
    await assertAvatarObject({
      key: parsed.data.key,
      expectedContentType: contentType,
      maxBytes,
    });
  } catch {
    return jsonError("Uploaded file could not be verified", 400);
  }

  const newImageUrl = getAvatarPublicUrl(parsed.data.key);

  const [current] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  const [updated] = await db
    .update(user)
    .set({
      image: newImageUrl,
      updatedAt: new Date(),
    })
    .where(eq(user.id, session.user.id))
    .returning({
      id: user.id,
      image: user.image,
      updatedAt: user.updatedAt,
    });

  if (!updated) {
    return jsonError("User not found", 404);
  }

  if (current?.image && current.image !== newImageUrl) {
    deleteAvatarObjectByUrl(current.image).catch(() => {
      // Best-effort cleanup for old avatar objects.
    });
  }

  return NextResponse.json({
    ok: true,
    imageUrl: updated.image,
    updatedAt: updated.updatedAt,
  });
}
