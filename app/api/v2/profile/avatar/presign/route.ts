import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, requireDashboardSession } from "@/lib/server/agents";
import {
  createAvatarUploadUrl,
  getAvatarLimits,
  isAllowedAvatarContentType,
  makeAvatarObjectKey,
} from "@/lib/server/r2";

const presignSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  contentLength: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const { session, response } = await requireDashboardSession();
  if (response || !session) return response;

  const body = await request.json().catch(() => null);
  const parsed = presignSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const contentType = parsed.data.contentType.toLowerCase();
  const { maxBytes } = getAvatarLimits();

  if (!isAllowedAvatarContentType(contentType)) {
    return jsonError("Unsupported file type. Allowed: JPG, PNG, GIF, WEBP", 400);
  }

  if (parsed.data.contentLength > maxBytes) {
    return jsonError("File is too large. Maximum size is 5MB", 400);
  }

  const key = makeAvatarObjectKey(session.user.id, contentType);
  const signed = await createAvatarUploadUrl({
    key,
    contentType,
    contentLength: parsed.data.contentLength,
  });

  return NextResponse.json({
    key,
    uploadUrl: signed.uploadUrl,
    expiresIn: signed.expiresIn,
    requiredHeaders: {
      "Content-Type": contentType,
    },
  });
}
