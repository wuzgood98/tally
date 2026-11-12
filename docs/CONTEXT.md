# Tally: project context

Read this before planning or building anything in Tally. It records what the project is, the decisions already made, the rules the code depends on, and what is and isn't built. When this file and the code disagree, the code wins: fix this file in the same change.

## What Tally is

Stock control for **one retailer with several branches**, at the scale of China Mall in Ghana: about five large general-merchandise stores plus a central warehouse, selling everything from rice to chest freezers, from local and imported (mostly Chinese) suppliers. It is **not** a mall that rents space to tenant shops; there is one company and one catalogue.

- Demo company: **Akwaaba Mall**, fictional. Branch locations are real Ghanaian places; the company, people and suppliers are made up. Never present it as China Mall or any real business.
- The company name comes from `TALLY_COMPANY_NAME` (`lib/site.ts`); the demo name is only the default.
- Currency: Ghana cedis (GH₵). Time zone: `Africa/Accra` (GMT all year, no daylight saving).
- Users: head office (`admin`), branch managers (`manager`), storekeepers (`storekeeper`), cashiers (`cashier`).

The user is a frontend engineer, and this is their first "real world" project after a run of portfolio sites. They chose: a multi-branch retailer; PostgreSQL + Drizzle + Better Auth; build in milestones, each in **batches**.

## Status

**Milestones 1 and 2 are done**: built, tested (78 tests), lint-clean, production build passing, smoke-tested for every role and scope, walked through in the browser at desktop and 390px. Both are committed and pushed to `main` at https://github.com/wuzgood98/tally. Commit only when the user asks.

| Area | Route(s) | Domain code |
| --- | --- | --- |
| Sign-in, demo accounts | `/login` | `lib/auth.ts`, `app/login/actions.ts` |
| Overview dashboard, incl. "On the way" | `/` | `lib/queries/overview.ts`, `components/stock/on-the-way-panel.tsx` |
| Product list, detail, create, edit | `/products`, `/products/[id]`, `/products/new`, `/products/[id]/edit` | `lib/catalogue.ts`, `lib/queries/products.ts` |
| Branch reorder point and shelf location | panel on `/products/[id]` | `setStockSettings` in `lib/catalogue.ts` |
| Receive goods (GRNs) | `/receipts`, `/receipts/new`, `/receipts/[id]` | `lib/stock/receive.ts` |
| Adjustments and stock counts | `/adjustments`, `/adjustments/new` | `lib/stock/adjust.ts` |
| Transfers: send, receive (incl. short), cancel | `/transfers`, `/transfers/new`, `/transfers/[id]` | `lib/stock/transfer.ts`, `lib/queries/transfers.ts` |
| Low stock, grouped by supplier, with "On the way" and a warehouse top-up | `/low-stock` | `getReorderLines` in `lib/queries/overview.ts`, `lib/stock/top-up.ts` |
| Movement ledger | `/movements` | `lib/queries/movements.ts` |
| Staff accounts | `/staff` | `lib/staff.ts` |
| Branch switcher ("scope") | header on every page | `lib/scope.ts`, `app/(app)/scope-action.ts` |

How transfers work (Milestone 2):

- **Sending** (`dispatchTransfer`) takes the stock out of the sender as `transfer_out` movements, at the products' average cost at that moment. The transfer is `in_transit` and its goods are on no branch's shelf.
- **Receiving** (`receiveTransfer`) adds what was counted at the receiver as `transfer_in`. Anything short is recorded as lost in transit on the transfer's lines.
- **Cancelling** (`cancelTransfer`) returns everything to the sender as `transfer_in` there.
- Document numbers come from the sender: `TRF-TMA-000042`.
- `/transfers/new?from=TMA&to=SPX&lines=12:40,15:10` pre-fills the form. The low-stock "Transfer from warehouse" button uses it, filling to twice the reorder point minus on hand and on the way (`topUpQuantity`).

Decisions the user accepted for transfers:

- Storekeepers may send and receive at their own branch.
- A short receipt is allowed with a required note. The shortfall is recorded as lost in transit on the transfer, not as an adjustment at either branch.
- Receiving more than was sent is refused; extras go in as a "found" adjustment.
- A manager at the sending branch, or head office, may cancel a transfer in transit, which returns the stock to the sender.
- Branch _requests_ for stock are out of scope; they belong with purchase orders. So "Transfer from warehouse" shows only to people who can send from the warehouse (head office and Tema staff), viewing a single store.

**Milestone 3, point-of-sale sales, is in progress** on the branch `milestone-3-sales`. The user asked for the rest of the roadmap to be built in order, each milestone in batches: sales, then purchase orders, then reports. Check in with them between milestones.

Decisions the user accepted for sales:

- Sales come from an in-app till screen **and** a sales API with per-till keys, both through `recordSale`.
- A sale is never refused for lack of stock. The balance goes below zero and the line is flagged for a count; only sales (and the write-off half of a damaged return) may do this.
- There is a new `cashier` role: sells at their own store and nothing else. Managers and head office can sell too; storekeepers can't.
- Customer returns are in scope. A manager approves each one; each line is restocked or written off as damaged.

Batches:

1. **Done**: migration `0002_sales`; `sale`, `sale_line`, `sale_return` and `sale_return_line` tables; movement kinds `sale` and `sale_return`; `recordSale` (`lib/stock/sales.ts`, idempotent on `(branch, client_ref)`) and `returnSale` (`lib/stock/returns.ts`); permissions `canSell`, `canApproveReturn` and `sellableBranchIds`; tests, including `saleMismatches`.
2. **Done**: till screen `/till` (`TillForm`: scan to basket, Cash / Mobile money / Card, cash received and change, warns when a line goes beyond the record; the clientRef is kept until the sale succeeds so retries can't double-charge; focus returns to the scan box after each sale), sales list `/sales` with today's total, sale detail `/sales/[id]`, Till and Sales in the nav, cashier in the staff form, and one demo cashier per store (Esi Quaye at Spintex is on the sign-in page). Payment labels live in `lib/stock/payment.ts`, kept free of the schema so client code doesn't bundle Drizzle. Walked through in the browser as a cashier at desktop and 390px.
3. **Done**: migration `0003_tills` (`till` table, `sale.till_id`). `POST /api/v1/sales` (`app/api/v1/sales/route.ts`) authenticates with `Authorization: Bearer tly_…` (`authenticateTill` in `lib/tills.ts`). Only a SHA-256 of each key is stored, with a 12-character prefix for display; the key is shown once on creation. The till's key fixes the store. Lines name products by SKU (any case) or barcode (`lib/sales-api.ts`) and may carry the POS's own `unitPrice`. Responses: 201 new, 200 `duplicate: true` on a resent `clientRef`, 400 / 401 / 404 as `{ error: { code, message } }`. `proxy.ts` lets `/api/v1` through without a session. `recordSale` (a person, checks `canSell`) and `recordTillSale` (a till) share `writeSale`. Head office manages tills on `/tills` (`canManageTills`): add, copy the key, two-step revoke, last used, sales count; the page documents the API with a curl example. POS sales show the till's name where a cashier would be. `pnpm till:simulate` (`scripts/till-simulator.ts`, needs `TALLY_TILL_KEY`) posts a few sales and resends the first. Checked end to end: key created in the browser, simulator 201s and a 200 duplicate, error codes, revoke → 401.
4. **Done**: returns on `/sales/[id]` for managers (`ReturnForm`, `returnSaleAction`): per line the quantity still returnable, "Back on the shelf" or "Damaged, write off", a required reason, and the refund. The sale page lists earlier returns (`getSaleReturns`, `ReturnsList`). Overview: a "Sales today" stat (units moved into the stock value detail) and "Best sellers, last 7 days" (`getBestSellers`; gross units, returns not netted, so reports should net them). Product page: a "Sold, 30 days" column (`getProductUnitsSold`). Movements: sales and returns labelled and linked to the sale (the damaged write-off after a return too), new "Sales" and "Customer returns" filters, and POS sales show the till's name. Stock status `"count"` ("Needs a count") for `on_hand < 0`, used by every `StockBadge`; the low-stock summary counts them. Walked through in the browser: cashier sees no return form, manager return with damaged and restock, negative line flagged; overview, sale page and Tills page (incl. the one-time key) checked at 390px.
5. Seed a month of sales (scaled down for PGlite), update this file, full verification.

**After Milestone 3:** purchase orders raised from the low-stock list (branch requests for warehouse stock could join this), then reports (stock value over time including goods in transit, fast and slow sellers from `sale_line`, shrinkage by branch including transit losses).

## Stack

Next.js 16.4 (App Router, Server Actions, `proxy.ts` instead of middleware), React 19.3, TypeScript 5, Tailwind CSS v4, Drizzle ORM 0.45 on PostgreSQL, Better Auth 1.7 (email and password plus the admin plugin), zod 4, Vitest 5, Ultracite 8.2 (Oxlint + Oxfmt), pnpm, Windows. Versions are in `package.json`; read the bundled Next docs before using any Next API (see `AGENTS.md`).

## The data model

`lib/db/schema.ts` is the single source of truth; migrations are in `drizzle/` (generate with `pnpm db:generate`).

- **Money**: integers in **pesewas** (GH₵1 = 100 pesewas) everywhere. Parse at the edge with `parseCedis`, display with `formatCedis` (`lib/money.ts`).
- **Quantities**: whole units. `unit` (each / pack / kg / litre / pair) is a label only.
- `branch`: ids are short codes used in document numbers. `SPX` Spintex, `WJA` Weija, `ASH` Ashaiman, `AMS` Amasaman, `KSI` Kumasi (Ahinsan), `TMA` Tema Distribution Centre (`kind: "warehouse"`).
- `product`: `sku` (unique, uppercase), `barcode` (optional, unique, GTIN with a validated check digit), `sell_price` (shelf price including VAT), `average_cost` (moving weighted average across **all** branches, updated by receipts), `reorder_point` (company default), `active` (false = discontinued; can't be received).
- `stock_level`: one row per (branch, product). `on_hand` (CHECK ≥ 0), `reorder_point` (branch override, null = product default), `bin_location`.
- `stock_movement`: **the ledger**. Signed `quantity` (never zero), `balance_after`, `kind` (`opening` / `receipt` / `adjustment` / `transfer_out` / `transfer_in`), `adjustment_reason` (set if and only if `kind = adjustment`), `transfer_id` (set if and only if the kind is a transfer), `unit_cost` for receipts and transfers, `receipt_id`, `user_id`, `note`.
- `goods_receipt`: the GRN header (`number` like `GRN-SPX-000042`, supplier, supplier reference, total cost). Its lines **are** its `stock_movement` rows; there is no separate line table.
- `stock_transfer`: `number` like `TRF-TMA-000001` (numbered by the **sending** branch), `from_branch_id` ≠ `to_branch_id`, `status` (`in_transit` / `received` / `cancelled`, with CHECKs tying `received_at` / `cancelled_at` to it), dispatcher, receiver or canceller, `note` (dispatch), `receive_note` (shortfall or cancellation reason), `total_cost`.
- `stock_transfer_line`: (`transfer_id`, `product_id`), `quantity_sent`, `quantity_received` (null until received; sent − received = lost in transit), `unit_cost` (average cost snapshotted at dispatch). Unlike GRNs, transfers need a line table: goods in transit are on no branch's `on_hand`, so the lines are their only record.
- `document_counter`: per-branch, per-prefix sequence for document numbers, claimed inside the transaction.
- Better Auth tables `user` / `session` / `account` / `verification`. `user.role` is a pg enum, `user.branch_id` is null for head office, and `user.banned` means deactivated.

## Rules the code depends on

These are invariants. New features must keep them. Transfers were added as new movement kinds through the same ledger; sales should be too.

1. **All stock changes go through `applyMovement`** in `lib/stock/ledger.ts`, inside a transaction. It updates `stock_level.on_hand` and appends the `stock_movement` row together. Never write `on_hand` directly anywhere else (the seed's opening balances are the one exception). Tests assert every balance equals the sum of its movements (`ledgerMismatches` in `test/db.ts`).
2. **Stock goes down only through one conditional UPDATE** (`on_hand + q >= 0` in the WHERE clause). No row updated means insufficient stock. This is what makes concurrent write-offs and transfers safe. **The one exception is a sale** (`allowNegative` on `applyMovement`): the customer is holding the item, so the sale goes through and the balance may go below zero. The `stock_level` CHECK (≥ 0) was dropped for this. Every query that sums stock must use `greatest(on_hand, 0)`; "out" means `on_hand <= 0`.
3. **Lock rows in a fixed order** (sorted by product id) when a transaction touches several products, so transactions can't deadlock.
4. **The ledger is append-only.** Mistakes are corrected with a new adjustment, never by editing or deleting movements.
5. **Permissions live in `lib/permissions.ts`** (pure, tested functions) and **every domain function checks them**. The UI calls the same functions only to hide controls. Rules: head office acts on any branch. Managers act on their own branch. Storekeepers may receive goods and write off `damaged` / `expired` at their own branch only. Storekeepers may also dispatch and receive transfers at their own branch. Cashiers may only sell at their own store; managers and head office may sell too, storekeepers may not. Returns need a manager. Theft, found, internal use, counts, reorder settings and cancelling a transfer need a manager. Catalogue and staff are head office only. Anyone may _view_ any branch.
6. **Validate twice.** Server Actions parse untrusted input at the boundary (zod, `lib/form.ts` helpers). Domain functions take typed input (`z.input<typeof schema>`) and parse it again. Business-rule failures throw `StockError` (`lib/stock/errors.ts`) with a message written for the user. Actions catch **only** `StockError` and return `{ error }`; anything else is rethrown (a bug).
7. **Goods in transit still belong to the company.** Dispatch is a `transfer_out` at the sender; receipt is a `transfer_in` at the receiver; cancelling is a `transfer_in` back at the sender. Anything counting company stock (average cost via `companyUnitsHeld` in `lib/stock/holdings.ts`, stock value) must add `in_transit` lines. Receiving and cancelling claim the transfer with a conditional UPDATE (`WHERE status = 'in_transit'`), so it settles once. Tests assert every transfer's movements match its lines (`transferMismatches` in `test/db.ts`).
8. Notes are required for theft, found and internal use (`NOTE_REQUIRED` in `lib/stock/reasons.ts`). Count adjustments compute the difference from a locked current balance; a count that matches is `no_change`, not an empty movement.

## Database and environment

- **No `DATABASE_URL`** → PGlite (Postgres in WebAssembly) in `.data/pglite`. The first request migrates and seeds it (`databaseReady()` in `lib/db/index.ts`).
- **With `DATABASE_URL`** → node-postgres. Migrate explicitly with `pnpm db:migrate`; it never auto-seeds.
- Docker isn't installed on this machine. The user's local PostgreSQL 17 runs on port **6942**, but its `postgres` password wasn't available (two attempts were rejected), so development uses PGlite. Ask the user before trying Postgres again.
- **Only one process may open `.data/pglite` at a time.** A dev server plus a script, or parallel build workers, corrupt it ("PGlite failed to initialize properly"). The fix is `pnpm db:reset` with the dev server stopped. This is why the connection and auth are created lazily, through `getDb()` and `getAuth()`; never connect at module import time.
- `.env.local` holds `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL=http://localhost:3500`; `.env.example` documents every variable.
- The seed's month of history runs in time order through the real domain functions: deliveries, adjustments and transfers. That gives 14 transfers: top-ups from TMA to every store, one Weija → Ashaiman, one cancelled, one received short at Kumasi, and two still in transit to Spintex and Kumasi. Each step is backdated after it runs. Movement ids must stay in time order, because the ledger lists newest first by id. A seed test checks this (`movementsOutOfOrder` in `test/db.ts`), so add new seeded activity as history events, never as a pass afterwards.
- Demo accounts (sign-in page, demo mode): every account uses the password `akwaaba-demo`. Head office `efua.asante@akwaaba.example`; Spintex manager `ama.mensah@…`; Spintex storekeeper `kofi.boateng@…`; the full list is `STAFF` in `lib/db/seed-data.ts`. The seed is deterministic (fixed random seed).
- New enum values: Postgres can't use an enum value in the transaction that adds it, and Drizzle runs migrations in one transaction. CHECK constraints that mention new values compare `kind::text` instead.
- Tests give each file its own in-memory PGlite with real migrations (`test/db.ts` → `createTestWorld()`).

## Conventions and gotchas

- **Lint is strict** (Ultracite anti-slop + react-doctor). Workflow: `pnpm exec ultracite fix`, then `pnpm exec ultracite check 2>&1 | python scripts/fix-spacing.py .` (inserts the blank lines `require-readable-spacing` wants), then `ultracite fix` again. Rules that shaped the code:
  - explicit null/undefined checks, never truthiness (`strict-boolean-expressions`);
  - no `typeof` checks or `unknown` parameters (parse at the edge);
  - no nested ternaries; components under 300 lines and complexity 20;
  - `<output>` instead of `role="status"`;
  - `SubmitEvent`, not the deprecated `FormEvent`;
  - no `confirm()` (staff deactivation uses a two-step button);
  - an IME `isComposing` guard on Enter handlers;
  - `oxlint-disable` comments must be **single-line**, with a reason after `--`.
- **Styling**: never restyle shadcn-style components with classes. Buttons use the `size="md"` variant. Table cells are `<Td numeric tone weight nowrap>` and `<Th numeric>` variants (`components/ui/table.tsx`). Colour tokens: `ink`, `ink-2`, `ink-3`, `brand`, `warn`, `danger`, `good`, `surface`, `paper`, `line`. Light and dark follow the system. Fonts: IBM Plex Sans and Plex Mono (SKUs, barcodes, document numbers).
- **React 19 forms**: a `<form action>` resets after the action, and selects revert to their first default. Forms that must keep values after an error use `onSubmit={submitWithoutReset(action)}` (`lib/submit-without-reset.ts`), keeping `action={action}` as well.
- **Drizzle subqueries**: aliased subquery columns are emitted without a table prefix. Give aliases unique names (`level_on_hand`), or joined columns with the same name become ambiguous (this caused a 500 on the products list in single-branch view).
- **Server pages**: `getViewer()` calls `connection()` so signed-in pages are never prerendered. Await `params`, `searchParams` and `requireViewer()` together with `Promise.all`.
- Domain code (`lib/stock`, `lib/catalogue.ts`, `lib/staff.ts`) takes a `Db` parameter and never imports the app's connection, so tests can pass an in-memory database. Server-only query modules (`lib/queries/*`) use `getDb()`.
- **Phone width**: an `sr-only` span is `position: absolute`, so inside a scrolling table wrapper that isn't positioned it escapes the clip and widens the page. Scroll wrappers are `relative overflow-x-auto` (the `Table` component does this). Line-item forms use `grid grid-cols-1` so their table wrapper can shrink below its content width.
- Barcode scanners type the code and press Enter. `ProductPicker` treats an exact barcode or SKU as an instant add; scanning the same item again increments its quantity.

## Verifying a change

1. `pnpm typecheck`, `pnpm test` and the lint workflow above: all clean.
2. `pnpm build`, with the dev server stopped (PGlite).
3. Smoke-test with `next start` and curl, signed in as each role, covering **every scope** (all branches, and a single branch) and the filters on the pages you touched. The single-branch path is where the subquery bug hid.
4. Check in the browser at desktop and phone width (390px): no horizontal page scroll.
