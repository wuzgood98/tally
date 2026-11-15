CREATE TABLE "company_settings" (
	"ask_tally_enabled" boolean DEFAULT false NOT NULL,
	"ask_tally_enabled_at" timestamp with time zone,
	"ask_tally_enabled_by_id" text,
	"ask_tally_disabled_at" timestamp with time zone,
	"ask_tally_disabled_by_id" text,
	"company_name" text,
	"default_reorder_point" integer DEFAULT 10 NOT NULL,
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"receipt_footer" text,
	"updated_at" timestamp with time zone,
	"updated_by_id" text,
	CONSTRAINT "company_settings_single_row" CHECK ("company_settings"."id" = 1),
	CONSTRAINT "company_settings_reorder_non_negative" CHECK ("company_settings"."default_reorder_point" >= 0)
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_ask_tally_enabled_by_id_user_id_fk" FOREIGN KEY ("ask_tally_enabled_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_ask_tally_disabled_by_id_user_id_fk" FOREIGN KEY ("ask_tally_disabled_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;