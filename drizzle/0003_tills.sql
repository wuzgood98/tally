CREATE TABLE "till" (
	"branch_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"id" serial PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"name" text NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "till_id" integer;--> statement-breakpoint
ALTER TABLE "till" ADD CONSTRAINT "till_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "till" ADD CONSTRAINT "till_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "till_key_hash_idx" ON "till" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "till_branch_idx" ON "till" USING btree ("branch_id");--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_till_id_till_id_fk" FOREIGN KEY ("till_id") REFERENCES "public"."till"("id") ON DELETE no action ON UPDATE no action;