CREATE TYPE "public"."notification_kind" AS ENUM('po_drafted', 'po_approved', 'po_cancelled', 'po_closed', 'transfer_dispatched', 'transfer_received_short', 'transfer_cancelled', 'request_raised', 'request_cancelled');--> statement-breakpoint
CREATE TABLE "notification" (
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"purchase_order_id" integer,
	"read_at" timestamp with time zone,
	"request_id" integer,
	"transfer_id" integer,
	"units" integer,
	"user_id" text NOT NULL,
	CONSTRAINT "notification_one_document" CHECK (num_nonnulls("notification"."purchase_order_id", "notification"."transfer_id", "notification"."request_id") = 1),
	CONSTRAINT "notification_document_matches_kind" CHECK (("notification"."kind"::text like 'po\_%') = ("notification"."purchase_order_id" is not null) and ("notification"."kind"::text like 'transfer\_%') = ("notification"."transfer_id" is not null) and ("notification"."kind"::text like 'request\_%') = ("notification"."request_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_request_id_stock_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."stock_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_transfer_id_stock_transfer_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "notification_unread_idx" ON "notification" USING btree ("user_id") WHERE "notification"."read_at" is null;