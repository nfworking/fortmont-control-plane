import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
	buildRequestAuditContext,
	extractEmailFromUnknown,
	getUserByEmail,
	recordAuditEvent,
} from "@/lib/server/audit";
import { toNextJsHandler } from "better-auth/next-js";

const handlers = toNextJsHandler(auth);

type AuthAction = "auth.sign_in" | "auth.sign_up" | "auth.sign_out";

function getAuthAction(pathname: string): AuthAction | null {
	if (pathname.includes("/sign-in")) return "auth.sign_in";
	if (pathname.includes("/sign-up")) return "auth.sign_up";
	if (pathname.includes("/sign-out")) return "auth.sign_out";
	return null;
}

export async function GET(request: NextRequest) {
	return handlers.GET(request);
}

export async function POST(request: NextRequest) {
	const action = getAuthAction(request.nextUrl.pathname);
	const context = buildRequestAuditContext(request);
	const preSession =
		action === "auth.sign_out"
			? await auth.api.getSession({ headers: request.headers })
			: null;
	const body = await request
		.clone()
		.json()
		.catch(() => null);
	const email = extractEmailFromUnknown(body);

	const response = await handlers.POST(request);

	if (!action) {
		return response;
	}

	const success = response.status >= 200 && response.status < 400;

	if (action === "auth.sign_out") {
		await recordAuditEvent({
			category: "auth",
			action,
			outcome: success ? "success" : "failure",
			actorType: preSession?.user?.id ? "user" : "unknown",
			userId: preSession?.user?.id ?? null,
			actorEmail: preSession?.user?.email ?? null,
			ipAddress: context.ipAddress,
			userAgent: context.userAgent,
			targetType: "session",
			message: success ? "User signed out" : "Sign out failed",
			metadata: {
				status: response.status,
				path: request.nextUrl.pathname,
				method: request.method,
			},
		});

		return response;
	}

	if (success) {
		return response;
	}

	const userByEmail = email ? await getUserByEmail(email) : null;

	await recordAuditEvent({
		category: "auth",
		action,
		outcome: "failure",
		actorType: userByEmail ? "user" : "unknown",
		userId: userByEmail?.id,
		actorEmail: userByEmail?.email ?? email,
		ipAddress: context.ipAddress,
		userAgent: context.userAgent,
		targetType: "session",
		message: `Authentication action failed: ${action}`,
		metadata: {
			status: response.status,
			path: request.nextUrl.pathname,
			method: request.method,
		},
	});

	return response;
}