ALTER TABLE "agent" ADD COLUMN "auth_token_hash" text;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "auth_token_issued_at" timestamp;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "auth_token_last_used_at" timestamp;
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_auth_token_hash_unique" UNIQUE("auth_token_hash");
--> statement-breakpoint
CREATE INDEX "agent_authTokenHash_idx" ON "agent" USING btree ("auth_token_hash");
