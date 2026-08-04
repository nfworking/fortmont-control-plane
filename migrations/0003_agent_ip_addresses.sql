ALTER TABLE "agent" ADD COLUMN "local_ip" text;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "public_ip" text;
--> statement-breakpoint
CREATE INDEX "agent_localIp_idx" ON "agent" USING btree ("local_ip");
--> statement-breakpoint
CREATE INDEX "agent_publicIp_idx" ON "agent" USING btree ("public_ip");
