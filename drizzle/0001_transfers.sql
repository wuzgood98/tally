CREATE TYPE "public"."transfer_status" AS ENUM('in_transit', 'received', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."movement_kind" ADD VALUE 'transfer_out';--> statement-breakpoint
ALTER TYPE "public"."movement_kind" ADD VALUE 'transfer_in';--> statement-breakpoint
CREATE TABLE "stock_transfer" (
	"cancelled_at" timestamp with time zone,
	"cancelled_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_by_id" text,
	"from_branch_id" text NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"note" text,
	"number" text NOT NULL,
	"receive_note" text,
	"received_at" timestamp with time zone,
	"received_by_id" text,
	"status" "transfer_status" DEFAULT 'in_transit' NOT NULL,
	"to_branch_id" text NOT NULL,
	"total_cost" integer NOT NULL,
	CONSTRAINT "stock_transfer_distinct_branches" CHECK ("stock_transfer"."from_branch_id" <> "stock_transfer"."to_branch_id"),
	CONSTRAINT "stock_transfer_received_matches_status" CHECK (("stock_transfer"."status"::text = 'received') = ("stock_transfer"."received_at" is not null)),
	CONSTRAINT "stock_transfer_cancelled_matches_status" CHECK (("stock_transfer"."status"::text = 'cancelled') = ("stock_transfer"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_line" (
	"product_id" integer NOT NULL,
	"quantity_received" integer,
	"quantity_sent" integer NOT NULL,
	"transfer_id" integer NOT NULL,
	"unit_cost" integer NOT NULL,
	CONSTRAINT "stock_transfer_line_transfer_id_product_id_pk" PRIMARY KEY("transfer_id","product_id"),
	CONSTRAINT "stock_transfer_line_sent_positive" CHECK ("stock_transfer_line"."quantity_sent" > 0),
	CONSTRAINT "stock_transfer_line_received_in_range" CHECK ("stock_transfer_line"."quantity_received" is null or ("stock_transfer_line"."quantity_received" >= 0 and "stock_transfer_line"."quantity_received" <= "stock_transfer_line"."quantity_sent")),
	CONSTRAINT "stock_transfer_line_cost_non_negative" CHECK ("stock_transfer_line"."unit_cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "stock_movement" ADD COLUMN "transfer_id" integer;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_cancelled_by_id_user_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_dispatched_by_id_user_id_fk" FOREIGN KEY ("dispatched_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_from_branch_id_branch_id_fk" FOREIGN KEY ("from_branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_received_by_id_user_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_to_branch_id_branch_id_fk" FOREIGN KEY ("to_branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_line" ADD CONSTRAINT "stock_transfer_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_line" ADD CONSTRAINT "stock_transfer_line_transfer_id_stock_transfer_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transfer_number_idx" ON "stock_transfer" USING btree ("number");--> statement-breakpoint
CREATE INDEX "stock_transfer_from_idx" ON "stock_transfer" USING btree ("from_branch_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_transfer_to_idx" ON "stock_transfer" USING btree ("to_branch_id","status");--> statement-breakpoint
CREATE INDEX "stock_transfer_line_product_idx" ON "stock_transfer_line" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_transfer_id_stock_transfer_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movement_transfer_idx" ON "stock_movement" USING btree ("transfer_id");--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_transfer_matches_kind" CHECK (("stock_movement"."kind"::text in ('transfer_out', 'transfer_in')) = ("stock_movement"."transfer_id" is not null));