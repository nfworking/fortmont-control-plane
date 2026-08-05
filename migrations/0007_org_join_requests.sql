CREATE TABLE "organization_join_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"label" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_join_link_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "organization_join_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"join_link_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"decided_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_join_link" ADD CONSTRAINT "organization_join_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_join_link" ADD CONSTRAINT "organization_join_link_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_join_request" ADD CONSTRAINT "organization_join_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_join_request" ADD CONSTRAINT "organization_join_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_join_request" ADD CONSTRAINT "organization_join_request_join_link_id_organization_join_link_id_fk" FOREIGN KEY ("join_link_id") REFERENCES "public"."organization_join_link"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_join_request" ADD CONSTRAINT "organization_join_request_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "organization_join_link_organizationId_idx" ON "organization_join_link" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "organization_join_link_tokenHash_idx" ON "organization_join_link" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "organization_join_link_enabled_idx" ON "organization_join_link" USING btree ("enabled");
--> statement-breakpoint
CREATE INDEX "organization_join_request_organizationId_idx" ON "organization_join_request" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "organization_join_request_userId_idx" ON "organization_join_request" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "organization_join_request_status_idx" ON "organization_join_request" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "organization_join_request_requestedAt_idx" ON "organization_join_request" USING btree ("requested_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_join_request_pending_unique_idx" ON "organization_join_request" USING btree ("organization_id", "user_id") WHERE "status" = 'pending';
