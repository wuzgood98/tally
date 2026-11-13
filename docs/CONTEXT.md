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

**Milestones 1 to 4 are done** and pushed to `main` at https://github.com/wuzgood98/tally (Milestone 3 is point-of-sale sales, Milestone 4 purchase orders and stock requests). **Milestone 5, reports, is being planned** on the branch `milestone-5-reports`. All four are tested (141 tests), lint-clean, production build passing, smoke-tested for every role (including cashiers) and scope, and walked through in the browser at desktop and 390px. Commit only when the user asks.

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
| Purchase orders: draft, approve, print, receive against, close short, cancel | `/purchase-orders`, `/purchase-orders/new`, `/purchase-orders/[id]` (+ `/edit`, `/print`, `/receive`) | `lib/stock/purchase-orders.ts`, `lib/stock/receive.ts`, `lib/queries/purchase-orders.ts` |
| Stock requests from stores to the warehouse | `/requests`, `/requests/new`, `/requests/[id]` | `lib/stock/requests.ts`, `lib/queries/requests.ts` |
| Movement ledger | `/movements` | `lib/queries/movements.ts` |
| Till (in-app point of sale) | `/till` | `recordSale` in `lib/stock/sales.ts`, `components/sales/till-form.tsx` |
| Sales list, sale detail and receipt, returns | `/sales`, `/sales/[id]` | `lib/queries/sales.ts`, `returnSale` in `lib/stock/returns.ts` |
| POS tills and their API keys (head office) | `/tills` | `lib/tills.ts`, `lib/queries/tills.ts` |
| Sales API for POS tills | `POST /api/v1/sales` | `app/api/v1/sales/route.ts`, `lib/sales-api.ts`, `recordTillSale` |
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

**Milestone 3, point-of-sale sales, is done.** The user asked for the rest of the roadmap to be built in order, each milestone in batches: sales, then purchase orders, then reports. Check in with them between milestones.

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
5. **Done**: the seed rings up 2–4 sales per store per day for the month, today included, through `recordSale` with each store's cashier; baskets only pick what the store holds. It also records about four manager-approved returns per store, about 30% of them damaged, and one deliberate oversell at Spintex so "Needs a count" has an example. At the fixed test date that gives 455 sales (16 today), 18 returns (5 damaged) and exactly one negative line. Seed tests check `saleMismatches`, the mix of sales and returns, and the single negative line. Fixed on the way: two correlated subqueries bound to the wrong table (see the Drizzle gotcha below), and stock forms now tell a cashier why they can't use them (`lib/access-messages.ts`).

**Milestone 4, purchase orders, is done** and on `main`. Next is Milestone 5, reports (stock value over time including goods in transit; fast and slow sellers from `sale_line`, netting returns; shrinkage by branch including transit losses).

Decisions the user accepted for purchase orders:

- **Approval:** branch managers draft POs for their own branch; head office approves and sends them, and can raise POs for any branch itself.
- **Unplanned deliveries:** the free-form goods-received form stays. Receiving against a PO is an extra path (local suppliers often deliver without one).
- **Branch requests:** a store manager requests stock from the warehouse from their low-stock list; warehouse staff fulfil each request as a transfer, and the request closes when that transfer is sent. (Left out of Milestone 2.)
- **Sending to the supplier:** a printable PO page (print or PDF, shared by WhatsApp or email by staff). Tally sends no email.

Planned batches:

1. **Done**: migration `0004_purchase_orders`; `purchase_order` and `purchase_order_line` (`quantity_received` kept up to date by receiving), `goods_receipt.purchase_order_id`, `stock_request` and `stock_request_line`.
   - `lib/stock/purchase-orders.ts`: `draftPurchaseOrder`, `updatePurchaseOrder` (drafts only), `approvePurchaseOrder` (sets `expected_at` from the supplier's lead time), `cancelPurchaseOrder` (a draft by its branch's manager, an approved order by head office), `closePurchaseOrder` (short, head office, part-delivered only). Every status change is a conditional UPDATE.
   - `receiveGoods` takes an optional `purchaseOrderId`: it locks the order row first, then refuses other branches or suppliers, products not ordered, and more than is outstanding; it fills the lines and sets `partly_received` or `received`.
   - `lib/stock/requests.ts`: `requestStock` (stores only, to the warehouse), `fulfilStockRequest` (claims the request under a row lock and calls `dispatchTransfer(tx, …)` in the same transaction, as a savepoint), `cancelStockRequest` (either side; adds the reason to the note).
   - Permissions: `canDraftPurchaseOrder`, `canApprovePurchaseOrder`, `canCancelDraftPurchaseOrder`, `canRequestStock`. Fulfilling uses `canDispatchTransfer` for the warehouse.
   - Tests, including `purchaseOrderMismatches` in `test/db.ts`.
2. **Done**: `/purchase-orders` (status filter, received/ordered units, expected date), `/purchase-orders/new` (`?branch=&supplier=&lines=12:40` pre-fills; `lineParam` in `lib/search-params.ts` is shared with the transfer form), `/purchase-orders/[id]` (Approve with a confirm step, Edit draft, Cancel or Close short with a reason, as permissions allow; lines with received and still due; deliveries against it), `/purchase-orders/[id]/edit` (drafts only; supplier and branch fixed; discontinued lines left out with a note), `/purchase-orders/[id]/print` (a clean document; warns on drafts and cancelled orders). Nav: Purchase orders, with a badge for head office counting drafts to approve. `PurchaseOrderForm` reuses the receive form's `ReceiptLineRow`; `orderLine` lives in `components/purchasing/order-line.ts` so server pages can call it. Walked through in the browser: manager drafts from a pre-fill, edits, head office approves, prints, cancels with a reason; all at 390px.
3. **Done**: an "On order" figure (units still due on approved or part-delivered orders, by branch) on low stock (`onOrder` on `getReorderLines`) and on product pages (`getProductOnOrder`, in the new `BranchStockTable`). `topUpQuantity` also subtracts what's on order, so warehouse transfers don't double up either. On low stock, viewing one branch you can draft for, each supplier group has "Order from this supplier", which opens `/purchase-orders/new` pre-filled with that supplier's top-up lines. Walked through in the browser: ordered from a supplier link, approved, then saw "On order" on low stock and the product page, the supplier's link drop out, and those products leave the warehouse top-up; managers see the links for their branch, storekeepers and cashiers don't; 390px.
4. **Done**: `/purchase-orders/[id]/receive` (for anyone who can receive at that branch, while the order is approved or part delivered): `ReceiveForm` in order mode (`order` and `initialLines` props) with each outstanding line at the agreed cost, branch and supplier fixed, no product picker (extras go on a separate receipt). The order page shows "Receive delivery"; receipts show "Against PO-…" and the receipts list shows the order under the supplier. Delivery errors name the product. Walked through in the browser as a storekeeper: refused over-delivery, part delivery left the order "Part delivered" with what's still due, a second delivery for the rest closed it as "Received"; 390px.
5. **Done**: `/requests` (follows the branch switcher: a store sees its requests, the warehouse sees requests to it), `/requests/new` (`RequestForm`, with "Here" and "At warehouse" columns, pre-fillable with `?branch=&lines=`), `/requests/[id]` (warehouse staff get `FulfilRequestForm`: each line starts at the smaller of what was asked and what the warehouse holds, nothing above what was asked, and sending opens the new transfer; either side can cancel with an optional reason). On low stock, viewing a store, `warehouseAction` gives people who can send from the warehouse "Transfer from warehouse", and the store's manager "Request from warehouse". Units on open requests now count in `topUpQuantity` (`requested` on `getReorderLines`), so the same stock can't be requested twice. Nav: Requests, with a badge counting open requests for whoever fulfils them (`countOpenRequests`). Also fixed: on a phone, the branch switcher showing "Tema Distribution Centre (yours)" pushed sign-out off the screen for warehouse staff; the switcher now shrinks. Walked through in the browser: manager requested from low stock, the suggestion dropped those lines, the warehouse manager saw the badge, an over-send was refused, sent 25 of 30 footballs on a transfer, the request shows "Sent on TRF-…"; 390px.
6. **Done**: the seed's purchasing lives in `lib/db/seed-purchasing.ts` (`planPurchasing`, `runPurchasingEvent`; `seed.ts` imports it, never the reverse). Every branch has an order received in full and one part delivered (Spintex's then closed short); Tema has one approved and undelivered (so "On order" has data); Spintex has a draft from this morning for head office to approve, and Kumasi one cancelled after approval. Every store has one request fulfilled by the warehouse and received (the request's transfer is handed back to the seed's arrival events via `registerTransfer`); Weija has one waiting and Amasaman one cancelled. Head office approvals use the first admin (`SeedStaff.headOffice`); lines only use active products. Seed tests check `purchaseOrderMismatches`, the status mix of orders and requests, and that every request's transfer was received.

**Milestone 5, reports**, on the branch `milestone-5-reports`.

Decisions the user accepted for reports:

- **Valuation:** every movement records the cost it moved at (`stock_movement.unit_cost` on every row, stamped by `applyMovement`: the receipt's cost for receipts, the average cost at that moment for everything else). Under average costing the value at any moment is the running sum of quantity × cost, so stock value over time comes straight from the ledger. Existing rows are backfilled from today's average cost; a reseed makes the demo exact.
- **Access:** head office sees every branch and the company total; branch managers see their own branch. Storekeepers and cashiers don't see Reports.
- **Export:** each report table has "Download CSV" (amounts in cedis). Printing works as elsewhere.

Planned batches:

1. **Done**: migration `0005_movement_cost` (backfills from today's average cost, then `unit_cost` not null; checked against the local demo data too). `applyMovement` stamps the product's average cost when the caller passes none. `canViewReports` (head office and managers) and `reportBranchIds` (`lib/reports/period.ts`: head office follows the switcher, a manager always gets their own branch, others none), with `reportPeriod` (the last 7 / 30 / 90 days, today included, UTC days = Accra days). The three queries live in `lib/reports/` and take an `Executor`, so they're tested against the test database (`reports.test.ts` works one product's month through by hand):
   - `getStockValueSeries`: end-of-day book value per branch (running sum of quantity × cost) and goods in transit to those branches at their dispatch cost.
   - `getSellers`: per product, units, takings (VAT included) and cost net of returns (a return counts on the day it came back, at the original sale line's price and cost), margin, units on hand, days of cover; products held but unsold are included.
   - `getShrinkage`: adjustments by branch and cause, signed (damaged customer returns as `returned_damaged`), transit losses by route (listed if either end is in the report), and cost of goods sold by branch for a shrinkage rate.
   - Raw SQL goes through `queryRows` (`lib/reports/rows.ts`, zod-checked rows; sums are coerced because node-postgres returns bigints as strings) with branch ids as bound parameters (`inList`).
   - The seed test checks the company's book value is within 1% of units × average cost (`bookValueTotals` in `test/db.ts`).
2. **Done**: Reports in the nav (`canViewReports`), `/reports` (a card per report; more cards come with batches 3 and 4) and `/reports/stock-value`:
   - Stats (value now, change over the period, goods in transit), a line chart of the total, a column chart of goods in transit (two single-series charts rather than a stacked band: transit is ~1% of the total and would be an invisible sliver), "By branch" (start of period, now, change, share; company view only) and "Day by day" (newest first, with each day's change).
   - `ReportToolbar` (`components/reports/report-toolbar.tsx`): 7 / 30 / 90 day links (`?days=`) and "Download CSV". `loadReportContext` (`lib/reports/context.ts`) gives a page its branches, period and label, or null → 404.
   - `TimeChart` (`components/reports/time-chart.tsx`, client): SVG and HTML, no chart library. A line hugs its data (a zero baseline flattens a few percent of movement); columns grow from zero. An invisible `<input type="range">` covers the plot, so hover, arrow keys, Home and End all move the readout, and screen readers get "13 Nov: GH₵…" as the value text. The table carries every value too.
   - Dynamic positions go through CSS custom properties (`style={{ "--x": "40%" }}` with `left-(--x)`); `types/css-variables.d.ts` lets `style` take `--*` keys. The lint rules forbid setting other properties inline.
   - CSV downloads are route handlers beside the page (`/reports/stock-value/csv`), using `csvResponse` (`lib/reports/csv.ts`): a UTF-8 byte-order mark for Excel, cedis with two decimals, and text cells that start like a formula get a leading apostrophe. They return 404 to anyone the page would.
   - Walked through in the browser as head office (hover, keyboard, CSV, 390px); checked with curl that a manager gets only their branch whatever the switcher says, and storekeepers and cashiers get 404 and no nav link.
3. **Done**: `/reports/sellers` and its CSV. `getSellers` now also returns `stockValue` (units held × today's average cost). `groupSellers` (pure, tested) splits rows into **fast** (sold, most units first), **slow** (cover over `SLOW_COVER_DAYS` = 90, longest first) and **not selling** (in stock, nothing sold net; most money tied up first), with period totals. The page shows units, takings, gross margin and money tied up in unsold lines, then 15 rows per group ("the CSV has them all"); cover over a year reads "1 yr+", under 7 days is amber, none on hand is "Out".
   - Margin is takings (VAT included) less cost: Tally stores no VAT rate, and Ghana's varies by item, so none is invented.
   - **The demo data is too quiet for this report**: the seed rings up 2–4 baskets per store per day (kept low so seeding stays quick) against a month of stock, so 147 of 148 selling lines show as slow and even the best seller "lasts" years. The rules are right; the demo volume isn't. To raise with the user in Batch 5.
4. **Done**: `/reports/shrinkage` and its CSV (branch table, a total row for several branches, then the routes table). `shrinkageByBranch` (pure, tested) turns ledger values into losses: every column is **stock lost at cost, positive**; "Counts and finds" nets count corrections against found stock, so it can be negative (a gain, shown in green with "found"). Columns: damaged, expired, theft, internal use, returned damaged, counts and finds, lost in transit; then net lost and the rate (net ÷ cost of goods sold, net of returns; none for the warehouse, which sells nothing). A transit loss counts against the branch that counted the transfer short; the routes table shows a route if either end is in the report, named from every branch (a manager's route starts at the warehouse). Stats: net lost, the rate, and the biggest cause. In the demo, counts are the biggest cause (GH₵10.6K of GH₵14.2K over 30 days, 3.5% of cost of sales).
5. Reseed, links from the overview, update this file, full verification.

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
8. **Purchase orders stay in step with their deliveries.** A receipt against an order locks the order row before any stock row, so concurrent deliveries can't overfill it; each line's `quantity_received` equals the receipt movements against the order, and the status follows from the lines (`purchaseOrderMismatches`). Fulfilling a stock request claims it and sends the transfer in one transaction, so a request makes at most one transfer.
9. **Every movement carries the cost it moved at** (`unit_cost`, not null): supplier cost for receipts, cost at dispatch for transfers, the average cost at that moment for everything else (`applyMovement` fills it in). Book value is the running sum of quantity × cost, and the reports use it. It can differ slightly from units × average cost: rounding, and a delivery that moves the average while goods are on the road (they keep their dispatch cost). The overview's "Stock value at cost" still uses units × average cost.
10. Notes are required for theft, found and internal use (`NOTE_REQUIRED` in `lib/stock/reasons.ts`). Count adjustments compute the difference from a locked current balance; a count that matches is `no_change`, not an empty movement.

## Database and environment

- **No `DATABASE_URL`** → PGlite (Postgres in WebAssembly) in `.data/pglite`. The first request migrates and seeds it (`databaseReady()` in `lib/db/index.ts`).
- **With `DATABASE_URL`** → node-postgres. Migrate explicitly with `pnpm db:migrate`; it never auto-seeds.
- Docker isn't installed on this machine. The user's local PostgreSQL 17 runs on port **6942**, but its `postgres` password wasn't available (two attempts were rejected), so development uses PGlite. Ask the user before trying Postgres again.
- **Only one process may open `.data/pglite` at a time.** A dev server plus a script, or parallel build workers, corrupt it ("PGlite failed to initialize properly"). The fix is `pnpm db:reset` with the dev server stopped. This is why the connection and auth are created lazily, through `getDb()` and `getAuth()`; never connect at module import time.
- `.env.local` holds `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL=http://localhost:3500`; `.env.example` documents every variable.
- The seed's month of history runs in time order through the real domain functions: deliveries, adjustments, transfers, sales and returns, purchase orders and stock requests. That gives 14 plain transfers (plus one per fulfilled request): top-ups from TMA to every store, one Weija → Ashaiman, one cancelled, one received short at Kumasi, and two still in transit to Spintex and Kumasi. Each step is backdated after it runs. Movement ids must stay in time order, because the ledger lists newest first by id. A seed test checks this (`movementsOutOfOrder` in `test/db.ts`), so add new seeded activity as history events, never as a pass afterwards.
- Demo accounts (sign-in page, demo mode): every account uses the password `akwaaba-demo`. Head office `efua.asante@akwaaba.example`; Spintex manager `ama.mensah@…`; Spintex storekeeper `kofi.boateng@…`; the full list is `STAFF` in `lib/db/seed-data.ts`. The seed is deterministic (fixed random seed).
- New enum values: Postgres can't use an enum value in the transaction that adds it, and Drizzle runs migrations in one transaction. CHECK constraints that mention new values compare `kind::text` instead.
- **Seeding takes time.** It's about 30 s in memory and about a minute on disk; the first `pnpm dev` on an empty `.data/pglite` and `pnpm db:reset` both pay it. `SALES_PER_DAY` in `lib/db/seed.ts` is the main lever. The seed test's `beforeAll` has its own 180 s timeout.
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
- **Drizzle and correlated subqueries**: in a select from a **single table with no joins**, Drizzle writes column names without a table prefix. So `${saleLine.saleId}` inside a raw `sql` subquery becomes a bare `"sale_id"`, and Postgres binds it to the _inner_ table if that table has the same column. This silently broke `returnableLines` (it summed every sale's returns) and `companyUnitsHeld` (`"id"` bound to `stock_transfer.id`). Tests with a single sale or matching ids hid it. Never reference an outer column inside a subquery of a single-table select: pass the value as a parameter (`${productId}`), or join an aggregated subquery (see `returnableLines`). Regression tests: `lib/stock/holdings.test.ts`, and "counts only this sale's returns" in `lib/stock/sales.test.ts`.
- **Drizzle subqueries**: aliased subquery columns are emitted without a table prefix. Give aliases unique names (`level_on_hand`), or joined columns with the same name become ambiguous (this caused a 500 on the products list in single-branch view).
- **Server pages**: `getViewer()` calls `connection()` so signed-in pages are never prerendered. Await `params`, `searchParams` and `requireViewer()` together with `Promise.all`.
- Domain code (`lib/stock`, `lib/catalogue.ts`, `lib/staff.ts`) takes a `Db` parameter and never imports the app's connection, so tests can pass an in-memory database. Server-only query modules (`lib/queries/*`) use `getDb()`.
- **Printing**: the app layout's sidebar, header and skip link are `print:hidden`, and the dark colour tokens apply to `screen` only, so printed pages (the purchase order) are always dark ink on paper.
- **Stopping a server**: stopping the background task for `next dev` or `next start` can leave its child Node processes running, still holding port 3500 and `.data/pglite`. Check for leftover `node` processes under the project and stop them by id before building or resetting.
- **Phone width**: an `sr-only` span is `position: absolute`, so inside a scrolling table wrapper that isn't positioned it escapes the clip and widens the page. Scroll wrappers are `relative overflow-x-auto` (the `Table` component does this). Line-item forms use `grid grid-cols-1` so their table wrapper can shrink below its content width.
- Barcode scanners type the code and press Enter. `ProductPicker` treats an exact barcode or SKU as an instant add; scanning the same item again increments its quantity.

## Verifying a change

1. `pnpm typecheck`, `pnpm test` and the lint workflow above: all clean.
2. `pnpm build`, with the dev server stopped (PGlite).
3. Smoke-test with `next start` and curl, signed in as each role, covering **every scope** (all branches, and a single branch) and the filters on the pages you touched. The single-branch path is where the subquery bug hid.
4. Check in the browser at desktop and phone width (390px): no horizontal page scroll.
