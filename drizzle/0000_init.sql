CREATE TYPE "public"."adjustment_reason" AS ENUM('damaged', 'expired', 'theft', 'count_correction', 'found', 'internal_use');--> statement-breakpoint
CREATE TYPE "public"."branch_kind" AS ENUM('store', 'warehouse');--> statement-breakpoint
CREATE TYPE "public"."movement_kind" AS ENUM('opening', 'receipt', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'manager', 'storekeeper');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('each', 'pack', 'kg', 'litre', 'pair');--> statement-breakpoint
CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch" (
	"address" text NOT NULL,
	"city" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"kind" "branch_kind" DEFAULT 'store' NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"department" text NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "document_counter" (
	"branch_id" text NOT NULL,
	"kind" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "document_counter_kind_branch_id_pk" PRIMARY KEY("kind","branch_id")
);
--> statement-breakpoint
CREATE TABLE "goods_receipt" (
	"branch_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"note" text,
	"number" text NOT NULL,
	"received_by_id" text,
	"supplier_id" integer NOT NULL,
	"supplier_reference" text,
	"total_cost" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"active" boolean DEFAULT true NOT NULL,
	"barcode" text,
	"category_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"average_cost" integer DEFAULT 0 NOT NULL,
	"default_supplier_id" integer,
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"reorder_point" integer DEFAULT 10 NOT NULL,
	"sell_price" integer NOT NULL,
	"sku" text NOT NULL,
	"unit" "unit" DEFAULT 'each' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_barcode_unique" UNIQUE("barcode"),
	CONSTRAINT "product_sku_unique" UNIQUE("sku"),
	CONSTRAINT "product_prices_non_negative" CHECK ("product"."sell_price" >= 0),
	CONSTRAINT "product_cost_non_negative" CHECK ("product"."average_cost" >= 0),
	CONSTRAINT "product_reorder_non_negative" CHECK ("product"."reorder_point" >= 0)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"impersonated_by" text,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stock_level" (
	"bin_location" text,
	"branch_id" text NOT NULL,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"product_id" integer NOT NULL,
	"reorder_point" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_level_branch_id_product_id_pk" PRIMARY KEY("branch_id","product_id"),
	CONSTRAINT "stock_level_on_hand_non_negative" CHECK ("stock_level"."on_hand" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"adjustment_reason" "adjustment_reason",
	"balance_after" integer NOT NULL,
	"branch_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" "movement_kind" NOT NULL,
	"note" text,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"receipt_id" integer,
	"unit_cost" integer,
	"user_id" text,
	CONSTRAINT "stock_movement_non_zero" CHECK ("stock_movement"."quantity" <> 0),
	CONSTRAINT "stock_movement_reason_matches_kind" CHECK (("stock_movement"."kind" = 'adjustment') = ("stock_movement"."adjustment_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"contact_name" text,
	"country" text DEFAULT 'GH' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text,
	"id" serial PRIMARY KEY NOT NULL,
	"lead_time_days" integer DEFAULT 7 NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	CONSTRAINT "supplier_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"ban_expires" timestamp with time zone,
	"ban_reason" text,
	"banned" boolean DEFAULT false NOT NULL,
	"branch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"name" text NOT NULL,
	"role" "role" DEFAULT 'storekeeper' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_counter" ADD CONSTRAINT "document_counter_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_received_by_id_user_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_default_supplier_id_supplier_id_fk" FOREIGN KEY ("default_supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_level" ADD CONSTRAINT "stock_level_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_level" ADD CONSTRAINT "stock_level_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_receipt_id_goods_receipt_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."goods_receipt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_number_idx" ON "goods_receipt" USING btree ("number");--> statement-breakpoint
CREATE INDEX "goods_receipt_branch_idx" ON "goods_receipt" USING btree ("branch_id","created_at");--> statement-breakpoint
CREATE INDEX "product_category_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_name_search_idx" ON "product" USING gin (to_tsvector('simple', "name"));--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_level_product_idx" ON "stock_level" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movement_branch_product_idx" ON "stock_movement" USING btree ("branch_id","product_id","id");--> statement-breakpoint
CREATE INDEX "stock_movement_created_idx" ON "stock_movement" USING btree ("created_at");