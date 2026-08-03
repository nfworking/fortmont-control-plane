import { createHash, randomBytes } from "crypto";

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export function hashJoinToken(rawToken: string) {
	return createHash("sha256").update(rawToken).digest("hex");
}

export function generateJoinToken() {
	return `agt_${randomBytes(24).toString("hex")}`;
}

export function jsonError(message: string, status = 400) {
	return NextResponse.json({ error: message }, { status });
}

export async function getDashboardSession() {
	return auth.api.getSession({
		headers: await headers(),
	});
}

export async function requireDashboardSession() {
	const session = await getDashboardSession();

	if (!session?.user?.id) {
		return {
			session: null,
			response: jsonError("Unauthorized", 401),
		};
	}

	return {
		session,
		response: null,
	};
}
