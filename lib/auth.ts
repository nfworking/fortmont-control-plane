import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/db/drizzle";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { recordAuditEvent } from "@/lib/server/audit";
import { getRequestPublicIp } from "@/lib/server/request-ip";
import { schema } from "@/db/schema";
import { organization } from "better-auth/plugins";
import { dash } from "@better-auth/infra";
import { sendEmailVerificationMessage } from "@/lib/server/email";

const organizationPlugin = organization({
  schema: {
    session: {
      fields: {
        activeOrganizationId: "activeOrganizationId",
      },
    },
   },
});

export const auth = betterAuth({
   appName: "Fortmont Cloud and IAM",
   trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:8090"],
   plugins: [nextCookies(), organizationPlugin, twoFactor(), dash()],
   socialProviders: {
      github: {
         clientId: process.env.GITHUB_CLIENT_ID as string,
         clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
         scope: ["read:user", "user:email"],
         mapProfileToUser: (profile) => ({
            email:
               profile.email ?? `${String(profile.id)}@github.placeholder.local`,
         }),
      },
   },
   user: {
      additionalFields: {
         onboarded: {
            type: "boolean",
            required: false,
            defaultValue: false,
         },
      },
  },
   emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
         ...coreFields,
         twoFactorEnabled: false,
         ...additionalFields,
         id,
      }),
   },
   emailVerification: {
      sendVerificationEmail: async ({ user, url }, request) => {
         console.info("[email-verification] callback invoked", {
            userId: user.id,
            email: user.email,
            hasWaitUntil: typeof (request as Request & { waitUntil?: unknown }).waitUntil === "function",
         });

         const sendPromise = sendEmailVerificationMessage({
            to: user.email,
            verificationUrl: url,
         }).catch((error) => {
            console.error("Failed to send verification email", error);
         });

         const requestWithWaitUntil = request as Request & {
            waitUntil?: (promise: Promise<unknown>) => void;
         };

         if (typeof requestWithWaitUntil.waitUntil === "function") {
            console.info("[email-verification] queued with waitUntil");
            requestWithWaitUntil.waitUntil(sendPromise);
            return;
         }

         console.info("[email-verification] running without waitUntil");
         void sendPromise;
      },
   },
   hooks: {
      after: createAuthMiddleware(async (ctx) => {
         const newSession = ctx.context.newSession;
         const path = ctx.path;

         if (!newSession || !path) {
            return;
         }

         const requestHeaders = ctx.headers ?? new Headers();
         const ipAddress = getRequestPublicIp(requestHeaders);
         const userAgent = requestHeaders.get("user-agent");

         if (path === "/sign-in/email") {
            await recordAuditEvent({
               organizationId: newSession.session.activeOrganizationId ?? null,
               category: "auth",
               action: "auth.sign_in",
               outcome: "success",
               actorType: "user",
               userId: newSession.user.id,
               actorEmail: newSession.user.email,
               ipAddress,
               userAgent,
               targetType: "session",
               targetId: newSession.session.id,
               message: "User signed in",
            });
         }

         if (path.startsWith("/sign-up")) {
            await recordAuditEvent({
               organizationId: newSession.session.activeOrganizationId ?? null,
               category: "auth",
               action: "auth.sign_up",
               outcome: "success",
               actorType: "user",
               userId: newSession.user.id,
               actorEmail: newSession.user.email,
               ipAddress,
               userAgent,
               targetType: "session",
               targetId: newSession.session.id,
               message: "User signed up",
            });
         }
      }),
   },
   database: drizzleAdapter(db, {
      provider: "pg",
    schema,
   }),
});