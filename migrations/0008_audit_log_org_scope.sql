ALTER TABLE "audit_log" ADD COLUMN "organization_id" text;
--> statement-breakpoint
UPDATE "audit_log" AS al
SET "organization_id" = a."organization_id"
FROM "agent" AS a
WHERE al."organization_id" IS NULL
  AND al."agent_id" = a."id";
--> statement-breakpoint
UPDATE "audit_log" AS al
SET "organization_id" = o."id"
FROM "organization" AS o
WHERE al."organization_id" IS NULL
  AND al."metadata" ->> 'organizationId' = o."id";
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "audit_log_organizationId_idx" ON "audit_log" USING btree ("organization_id");
