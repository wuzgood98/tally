# Tally: project context

Read this before planning or building anything in Tally. It records what the project is, the decisions already made, the rules the code depends on, and what is and isn't built. When this file and the code disagree, the code wins: fix this file in the same change.

## What Tally is

Stock control for **one retailer with several branches**, at the scale of China Mall in Ghana: about five large general-merchandise stores plus a central warehouse, selling everything from rice to chest freezers, from local and imported (mostly Chinese) suppliers. It is **not** a mall that rents space to tenant shops; there is one company and one catalogue.

- Demo company: **Akwaaba Mall**, fictional. Branch locations are real Ghanaian places; the company, people and suppliers are made up. Never present it as China Mall or any real business.
- The company name comes from `TALLY_COMPANY_NAME` (`lib/site.ts`); the demo name is only the default.
- Currency: Ghana cedis (GH₵). Time zone: `Africa/Accra` (GMT all year, no daylight saving).
- Users: head office (`admin`), branch managers (`manager`), storekeepers (`storekeeper`).

The user is a frontend engineer, and this is their first "real world" project after a run of portfolio sites. They chose: a multi-branch retailer; PostgreSQL + Drizzle + Better Auth; build in milestones, each in **batches**.

## Status

**Milestone 1, the core stock loop, is done**: built, tested (55 tests), lint-clean, production build passing, walked through in the browser. It is committed and pushed to `main` at https://github.com/wuzgood98/tally. Commit only when the user asks.

Built in Milestone 1:

| Area | Route(s) | Domain code |
| --- | --- | --- |
| Sign-in, demo accounts | `/login` | `lib/auth.ts`, `app/login/actions.ts` |
| Overview dashboard | `/` | `lib/queries/overview.ts` |
| Product list, detail, create, edit | `/products`, `/products/[id]`, `/products/new`, `/products/[id]/edit` | `lib/catalogue.ts`, `lib/queries/products.ts` |
| Branch reorder point and shelf location | panel on `/products/[id]` | `setStockSettings` in `lib/catalogue.ts` |
| Receive goods (GRNs) | `/receipts`, `/receipts/new`, `/receipts/[id]` | `lib/stock/receive.ts` |
| Adjustments and stock counts | `/adjustments`, `/adjustments/new` | `lib/stock/adjust.ts` |
| Low stock, grouped by supplier | `/low-stock` | `getReorderLines` in `lib/queries/overview.ts` |
| Movement ledger | `/movements` | `lib/queries/movements.ts` |
| Staff accounts | `/staff` | `lib/staff.ts` |
| Branch switcher ("scope") | header on every page | `lib/scope.ts`, `app/(app)/scope-action.ts` |

**Milestone 2, transfers between branches, is in progress.** Plan, in batches:

1. **Done**: schema, migration `0001_transfers`, domain code (`lib/stock/transfer.ts`), permissions, the average-cost fix for goods in transit, tests.
2. **Done**: `/transfers` list (status filter; direction filter in single-branch scope), `/transfers/new` (`?from=&to=&lines=12:40,15:10` pre-fills; blocks quantities above what the sender holds), read-only `/transfers/[id]`, nav entry. Queries in `lib/queries/transfers.ts` (aliased `branch` / `user` joins via `alias()`). Walked through in the browser (storekeeper sending, blocked over-quantity, 390px).
3. **Done**: receive form on `/transfers/[id]` (`ReceiveTransferForm`, pre-filled with sent quantities; shortfall needs a note), two-step cancel for sending managers (`CancelTransferForm`), "On the way" panel on the overview and an incoming badge on the Transfers nav item (`countIncomingInTransit`), transfer kinds labelled and linked in every movement table (and filterable on `/movements`), an "On the way" column on product detail (`getProductInTransit`) and in `ReorderTable` (`inTransit` on `getReorderLines`), and a "Transfer from warehouse" button on `/low-stock` for people who can send from the warehouse, viewing one store. It pre-fills `topUpQuantity` (`lib/stock/top-up.ts`): fill to twice the reorder point, minus on hand and on the way. Walked through in the browser at desktop and 390px.
4. Seed demo transfers (received, in transit to SPX and KSI, one short), update this file, full verification.

Decisions the user accepted: storekeepers may dispatch and receive at their own branch; a short receipt is allowed with a required note and the shortfall is recorded as lost in transit on the transfer (not an adjustment at either branch); receiving more than was sent is refused (extras go in as a "found" adjustment); a manager at the sending branch (or head office) may cancel a transfer in transit, which returns the stock to the sender; branch _requests_ for stock are out of scope (they belong with purchase orders).

**Later milestones** (order not chosen): point-of-sale sales; purchase orders raised from the low-stock list; reports (stock value over time, fast and slow sellers, shrinkage by branch, including transit losses).

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

These are invariants. New features must keep them; Milestone 2 features (transfers, sales) are new movement kinds through the same ledger.

1. **All stock changes go through `applyMovement`** in `lib/stock/ledger.ts`, inside a transaction. It updates `stock_level.on_hand` and appends the `stock_movement` row together. Never write `on_hand` directly anywhere else (the seed's opening balances are the one exception). Tests assert every balance equals the sum of its movements (`ledgerMismatches` in `test/db.ts`).
2. **Stock goes down only through one conditional UPDATE** (`on_hand + q >= 0` in the WHERE clause). No row updated means insufficient stock. This is what makes concurrent write-offs and sales safe.
3. **Lock rows in a fixed order** (sorted by product id) when a transaction touches several products, so transactions can't deadlock.
4. **The ledger is append-only.** Mistakes are corrected with a new adjustment, never by editing or deleting movements.
5. **Permissions live in `lib/permissions.ts`** (pure, tested functions) and **every domain function checks them**. The UI calls the same functions only to hide controls. Rules: head office acts on any branch. Managers act on their own branch. Storekeepers may receive goods and write off `damaged` / `expired` at their own branch only. Storekeepers may also dispatch and receive transfers at their own branch. Theft, found, internal use, counts, reorder settings and cancelling a transfer need a manager. Catalogue and staff are head office only. Anyone may _view_ any branch.
6. **Validate twice.** Server Actions parse untrusted input at the boundary (zod, `lib/form.ts` helpers). Domain functions take typed input (`z.input<typeof schema>`) and parse it again. Business-rule failures throw `StockError` (`lib/stock/errors.ts`) with a message written for the user. Actions catch **only** `StockError` and return `{ error }`; anything else is rethrown (a bug).
7. **Goods in transit still belong to the company.** Dispatch is a `transfer_out` at the sender; receipt is a `transfer_in` at the receiver; cancelling is a `transfer_in` back at the sender. Anything counting company stock (average cost via `companyUnitsHeld` in `lib/stock/holdings.ts`, stock value) must add `in_transit` lines. Receiving and cancelling claim the transfer with a conditional UPDATE (`WHERE status = 'in_transit'`), so it settles once. Tests assert every transfer's movements match its lines (`transferMismatches` in `test/db.ts`).
8. Notes are required for theft, found and internal use (`NOTE_REQUIRED` in `lib/stock/reasons.ts`). Count adjustments compute the difference from a locked current balance; a count that matches is `no_change`, not an empty movement.

## Database and environment

- **No `DATABASE_URL`** → PGlite (Postgres in WebAssembly) in `.data/pglite`. The first request migrates and seeds it (`databaseReady()` in `lib/db/index.ts`).
- **With `DATABASE_URL`** → node-postgres. Migrate explicitly with `pnpm db:migrate`; it never auto-seeds.
- Docker isn't installed on this machine. The user's local PostgreSQL 17 runs on port **6942**, but its `postgres` password wasn't available (two attempts were rejected), so development uses PGlite. Ask the user before trying Postgres again.
- **Only one process may open `.data/pglite` at a time.** A dev server plus a script, or parallel build workers, corrupt it ("PGlite failed to initialize properly"). The fix is `pnpm db:reset` with the dev server stopped. This is why the connection and auth are created lazily, through `getDb()` and `getAuth()`; never connect at module import time.
- `.env.local` holds `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL=http://localhost:3500`; `.env.example` documents every variable.
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
