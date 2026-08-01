CREATE TYPE "public"."entitlement_status" AS ENUM('free', 'trialing', 'active', 'grace_period', 'billing_retry', 'expired', 'refunded', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."subscription_source" AS ENUM('apple', 'stripe', 'preview');--> statement-breakpoint
CREATE TABLE "ai_usage_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"month" text NOT NULL,
	"category" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_account_id" uuid,
	"child_profile_id" uuid,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_account_id" uuid,
	"encrypted_profile" jsonb NOT NULL,
	"cloud_sync_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_account_id" uuid NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"policy_version" text NOT NULL,
	"method" text NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "parent_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "share_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"shared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscription_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_account_id" uuid NOT NULL,
	"status" "entitlement_status" DEFAULT 'free' NOT NULL,
	"source" "subscription_source",
	"plan" text,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"current_period_ends_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"encrypted_payload" jsonb NOT NULL,
	"client_updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_usage_summaries" ADD CONSTRAINT "ai_usage_summaries_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_parent_account_id_parent_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_records" ADD CONSTRAINT "sync_records_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_unique" ON "ai_usage_summaries" USING btree ("child_profile_id","month","category");--> statement-breakpoint
CREATE INDEX "child_parent_index" ON "child_profiles" USING btree ("parent_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_email_unique" ON "parent_accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "share_child_index" ON "share_grants" USING btree ("child_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_parent_unique" ON "subscription_entitlements" USING btree ("parent_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_entity_unique" ON "sync_records" USING btree ("child_profile_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "sync_child_updated_index" ON "sync_records" USING btree ("child_profile_id","updated_at");