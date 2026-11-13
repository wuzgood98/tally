-- Movements written before every movement carried a cost: value them at
-- today's average cost. Reseeding the demo makes its history exact.
UPDATE "stock_movement" AS m SET "unit_cost" = p."average_cost" FROM "product" AS p WHERE p."id" = m."product_id" AND m."unit_cost" IS NULL;--> statement-breakpoint
ALTER TABLE "stock_movement" ALTER COLUMN "unit_cost" SET NOT NULL;
