import { betterAuth } from "better-auth";
import { db } from "@/db/drizzle";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { schema } from "@/db/schema";

export const auth = betterAuth({
   plugins: [nextCookies()],
   emailAndPassword: {
    enabled: true,
  },
 database: drizzleAdapter(db, {
    provider:"pg",
    schema,
 }),
 
});