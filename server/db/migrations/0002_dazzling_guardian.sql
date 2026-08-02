CREATE TYPE "public"."care_request_status" AS ENUM('open', 'acknowledged', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."notification_job_status" AS ENUM('pending', 'processing', 'sent', 'retry', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."owner_role" AS ENUM('parent', 'child');--> statement-breakpoint
CREATE TABLE "care_request_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_request_id" uuid NOT NULL,
	"parent_account_id" uuid NOT NULL,
	"response_code" text NOT NULL,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_account_id" uuid NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"encrypted_items" jsonb NOT NULL,
	"encrypted_note" jsonb,
	"urgent_safety" boolean DEFAULT false NOT NULL,
	"status" "care_request_status" DEFAULT 'open' NOT NULL,
	"client_request_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cycle_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"estimated_date" text NOT NULL,
	"confidence" text NOT NULL,
	"source_revision" text NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_link_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_account_id" uuid NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_account_id" uuid,
	"child_profile_id" uuid,
	"owner_role" "owner_role" NOT NULL,
	"encrypted_expo_token" jsonb NOT NULL,
	"token_fingerprint" text NOT NULL,
	"platform" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_registration_id" uuid NOT NULL,
	"parent_account_id" uuid NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"opaque_event_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"template_code" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "notification_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"receipt_id" text,
	"last_error_code" text,
	"deduplication_key" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_reminder_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_account_id" uuid NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"quiet_hours_start" integer DEFAULT 20 NOT NULL,
	"quiet_hours_end" integer DEFAULT 7 NOT NULL,
	"lead_days" jsonb DEFAULT '[5,1]'::jsonb NOT NULL,
	"phrase_code" text DEFAULT 'garden-moment' NOT NULL,
	"consented_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_role" "owner_role" NOT NULL,
	"owner_id" text NOT NULL,
	"child_profile_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_records" ADD COLUMN "revision_key" text;--> statement-breakpoint
UPDATE "sync_records" SET "revision_key" = "id"::text WHERE "revision_key" IS NULL;--> statement-breakpoint
ALTER TABLE "sync_records" ALTER COLUMN "revision_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "care_request_responses" ADD CONSTRAINT "care_request_responses_care_request_id_care_requests_id_fk" FOREIGN KEY ("care_request_id") REFERENCES "public"."care_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_request_responses" ADD CONSTRAINT "care_request_responses_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_forecasts" ADD CONSTRAINT "cycle_forecasts_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_link_codes" ADD CONSTRAINT "device_link_codes_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_link_codes" ADD CONSTRAINT "device_link_codes_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_device_registration_id_device_registrations_id_fk" FOREIGN KEY ("device_registration_id") REFERENCES "public"."device_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_reminder_preferences" ADD CONSTRAINT "parent_reminder_preferences_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_reminder_preferences" ADD CONSTRAINT "parent_reminder_preferences_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_records" ADD CONSTRAINT "session_records_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "care_request_client_unique" ON "care_requests" USING btree ("child_profile_id","client_request_id");--> statement-breakpoint
CREATE INDEX "care_request_child_status_index" ON "care_requests" USING btree ("child_profile_id","status");--> statement-breakpoint
CREATE INDEX "care_request_parent_status_index" ON "care_requests" USING btree ("parent_account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_forecast_child_unique" ON "cycle_forecasts" USING btree ("child_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_link_code_hash_unique" ON "device_link_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "device_token_fingerprint_unique" ON "device_registrations" USING btree ("token_fingerprint");--> statement-breakpoint
CREATE INDEX "device_parent_enabled_index" ON "device_registrations" USING btree ("parent_account_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_link_token_hash_unique" ON "magic_link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_dedupe_unique" ON "notification_jobs" USING btree ("deduplication_key");--> statement-breakpoint
CREATE INDEX "notification_due_index" ON "notification_jobs" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_reminder_child_unique" ON "parent_reminder_preferences" USING btree ("parent_account_id","child_profile_id");--> statement-breakpoint
CREATE INDEX "session_owner_index" ON "session_records" USING btree ("owner_role","owner_id");
