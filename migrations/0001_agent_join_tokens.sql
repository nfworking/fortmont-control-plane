CREATE TABLE "agent_join_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"label" text,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_join_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "agent_join_token" ADD CONSTRAINT "agent_join_token_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_join_token_hash_idx" ON "agent_join_token" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "agent_join_token_expiresAt_idx" ON "agent_join_token" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "agent_join_token_revoked_idx" ON "agent_join_token" USING btree ("revoked");
