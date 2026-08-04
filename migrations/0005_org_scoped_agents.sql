ALTER TABLE "agent" ADD COLUMN "organization_id" text;
--> statement-breakpoint
ALTER TABLE "agent_join_token" ADD COLUMN "organization_id" text;
--> statement-breakpoint
INSERT INTO "organization" ("id", "name", "slug", "created_at", "metadata")
SELECT '00000000-0000-0000-0000-000000000000', 'Default Organization', 'default-organization', now(), '{}'::text
WHERE NOT EXISTS (SELECT 1 FROM "organization");
--> statement-breakpoint
UPDATE "agent" SET "organization_id" = '00000000-0000-0000-0000-000000000000' WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "agent_join_token" SET "organization_id" = '00000000-0000-0000-0000-000000000000' WHERE "organization_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_join_token" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_join_token" ADD CONSTRAINT "agent_join_token_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_organizationId_idx" ON "agent" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "agent_join_token_organizationId_idx" ON "agent_join_token" USING btree ("organization_id");
