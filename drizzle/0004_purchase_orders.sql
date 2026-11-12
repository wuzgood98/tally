CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'approved', 'partly_received', 'received', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stock_request_status" AS ENUM('requested', 'fulfilled', 'cancelled');--> statement-breakpoint
CREATE TABLE "purchase_order" (
	"approved_at" timestamp with time zone,
	"approved_by_id" text,
	"branch_id" text NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_id" text,
	"close_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"expected_at" timestamp with time zone,
	"id" serial PRIMARY KEY NOT NULL,
	"note" text,
	"number" text NOT NULL,
	"status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
	"supplier_id" integer NOT NULL,
	"total_cost" integer NOT NULL,
	CONSTRAINT "purchase_order_approved_matches_status" CHECK (("purchase_order"."status"::text <> 'draft' or "purchase_order"."approved_at" is null) and ("purchase_order"."status"::text not in ('approved', 'partly_received', 'received', 'closed') or "purchase_order"."approved_at" is not null)),
	CONSTRAINT "purchase_order_closed_matches_status" CHECK (("purchase_order"."status"::text in ('received', 'closed', 'cancelled')) = ("purchase_order"."closed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "purchase_order_line" (
	"product_id" integer NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"quantity_received" integer DEFAULT 0 NOT NULL,
	"unit_cost" integer NOT NULL,
	CONSTRAINT "purchase_order_line_purchase_order_id_product_id_pk" PRIMARY KEY("purchase_order_id","product_id"),
	CONSTRAINT "purchase_order_line_quantity_positive" CHECK ("purchase_order_line"."quantity" > 0),
	CONSTRAINT "purchase_order_line_received_in_range" CHECK ("purchase_order_line"."quantity_received" >= 0 and "purchase_order_line"."quantity_received" <= "purchase_order_line"."quantity"),
	CONSTRAINT "purchase_order_line_cost_non_negative" CHECK ("purchase_order_line"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_request" (
	"branch_id" text NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"from_branch_id" text NOT NULL,
	"fulfilled_at" timestamp with time zone,
	"id" serial PRIMARY KEY NOT NULL,
	"note" text,
	"number" text NOT NULL,
	"status" "stock_request_status" DEFAULT 'requested' NOT NULL,
	"transfer_id" integer,
	CONSTRAINT "stock_request_fulfilled_matches_status" CHECK (("stock_request"."status"::text = 'fulfilled') = ("stock_request"."fulfilled_at" is not null and "stock_request"."transfer_id" is not null)),
	CONSTRAINT "stock_request_cancelled_matches_status" CHECK (("stock_request"."status"::text = 'cancelled') = ("stock_request"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "stock_request_line" (
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"request_id" integer NOT NULL,
	CONSTRAINT "stock_request_line_request_id_product_id_pk" PRIMARY KEY("request_id","product_id"),
	CONSTRAINT "stock_request_line_quantity_positive" CHECK ("stock_request_line"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD COLUMN "purchase_order_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_closed_by_id_user_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request" ADD CONSTRAINT "stock_request_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request" ADD CONSTRAINT "stock_request_cancelled_by_id_user_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request" ADD CONSTRAINT "stock_request_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request" ADD CONSTRAINT "stock_request_from_branch_id_branch_id_fk" FOREIGN KEY ("from_branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request" ADD CONSTRAINT "stock_request_transfer_id_stock_transfer_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request_line" ADD CONSTRAINT "stock_request_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request_line" ADD CONSTRAINT "stock_request_line_request_id_stock_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."stock_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_number_idx" ON "purchase_order" USING btree ("number");--> statement-breakpoint
CREATE INDEX "purchase_order_branch_idx" ON "purchase_order" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "purchase_order_supplier_idx" ON "purchase_order" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_order_line_product_idx" ON "purchase_order_line" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_request_number_idx" ON "stock_request" USING btree ("number");--> statement-breakpoint
CREATE INDEX "stock_request_from_idx" ON "stock_request" USING btree ("from_branch_id","status");--> statement-breakpoint
CREATE INDEX "stock_request_branch_idx" ON "stock_request" USING btree ("branch_id","created_at");--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE no action ON UPDATE no action;