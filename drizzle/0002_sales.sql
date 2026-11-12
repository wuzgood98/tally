CREATE TYPE "public"."payment_method" AS ENUM('cash', 'mobile_money', 'card');--> statement-breakpoint
CREATE TYPE "public"."return_disposition" AS ENUM('restock', 'damaged');--> statement-breakpoint
ALTER TYPE "public"."movement_kind" ADD VALUE 'sale';--> statement-breakpoint
ALTER TYPE "public"."movement_kind" ADD VALUE 'sale_return';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'cashier';--> statement-breakpoint
CREATE TABLE "sale" (
	"branch_id" text NOT NULL,
	"cashier_id" text,
	"client_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"total" integer NOT NULL,
	CONSTRAINT "sale_total_non_negative" CHECK ("sale"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale_line" (
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"sale_id" integer NOT NULL,
	"unit_cost" integer NOT NULL,
	"unit_price" integer NOT NULL,
	CONSTRAINT "sale_line_sale_id_product_id_pk" PRIMARY KEY("sale_id","product_id"),
	CONSTRAINT "sale_line_quantity_positive" CHECK ("sale_line"."quantity" > 0),
	CONSTRAINT "sale_line_price_non_negative" CHECK ("sale_line"."unit_price" >= 0),
	CONSTRAINT "sale_line_cost_non_negative" CHECK ("sale_line"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale_return" (
	"approved_by_id" text,
	"branch_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"reason" text NOT NULL,
	"refund" integer NOT NULL,
	"sale_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_return_line" (
	"disposition" "return_disposition" NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"return_id" integer NOT NULL,
	CONSTRAINT "sale_return_line_return_id_product_id_pk" PRIMARY KEY("return_id","product_id"),
	CONSTRAINT "sale_return_line_quantity_positive" CHECK ("sale_return_line"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "stock_level" DROP CONSTRAINT "stock_level_on_hand_non_negative";--> statement-breakpoint
ALTER TABLE "stock_movement" ADD COLUMN "sale_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD COLUMN "sale_return_id" integer;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_cashier_id_user_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return" ADD CONSTRAINT "sale_return_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return" ADD CONSTRAINT "sale_return_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return" ADD CONSTRAINT "sale_return_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_line" ADD CONSTRAINT "sale_return_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_line" ADD CONSTRAINT "sale_return_line_return_id_sale_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."sale_return"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_number_idx" ON "sale" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_client_ref_idx" ON "sale" USING btree ("branch_id","client_ref");--> statement-breakpoint
CREATE INDEX "sale_branch_idx" ON "sale" USING btree ("branch_id","created_at");--> statement-breakpoint
CREATE INDEX "sale_line_product_idx" ON "sale_line" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_return_number_idx" ON "sale_return" USING btree ("number");--> statement-breakpoint
CREATE INDEX "sale_return_sale_idx" ON "sale_return" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_return_branch_idx" ON "sale_return" USING btree ("branch_id","created_at");--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_sale_return_id_sale_return_id_fk" FOREIGN KEY ("sale_return_id") REFERENCES "public"."sale_return"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movement_sale_idx" ON "stock_movement" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "stock_movement_return_idx" ON "stock_movement" USING btree ("sale_return_id");--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_sale_matches_kind" CHECK (("stock_movement"."kind"::text = 'sale') = ("stock_movement"."sale_id" is not null));--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_return_matches_kind" CHECK (("stock_movement"."kind"::text <> 'sale_return' or "stock_movement"."sale_return_id" is not null) and ("stock_movement"."sale_return_id" is null or "stock_movement"."kind"::text in ('sale_return', 'adjustment')));