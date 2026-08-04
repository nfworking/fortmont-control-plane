CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"actor_type" text NOT NULL,
	"user_id" text,
	"actor_email" text,
	"agent_id" uuid,
	"device_id" text,
	"ip_address" text,
	"user_agent" text,
	"target_type" text,
	"target_id" text,
	"message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "audit_log_category_idx" ON "audit_log" USING btree ("category");
--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");
--> statement-breakpoint
CREATE INDEX "audit_log_outcome_idx" ON "audit_log" USING btree ("outcome");
--> statement-breakpoint
CREATE INDEX "audit_log_userId_idx" ON "audit_log" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "audit_log_agentId_idx" ON "audit_log" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "audit_log_deviceId_idx" ON "audit_log" USING btree ("device_id");
