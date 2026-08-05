import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/db/drizzle";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { recordAuditEvent } from "@/lib/server/audit";
import { getRequestPublicIp } from "@/lib/server/request-ip";
import { schema } from "@/db/schema";
import { organization } from "better-auth/plugins"

const organizationPlugin = organization({
  schema: {
    session: {
      fields: {
        activeOrganizationId: "activeOrganizationId",
      },
    },
  },
})

export const auth = betterAuth({
   appName: "Fortmont Cloud and IAM",
   plugins: [nextCookies(), organizationPlugin, twoFactor() ],
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
    provider:"pg",
    schema,
 }),
 
});