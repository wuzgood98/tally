# Tally

Stock control for a multi-branch retailer at the scale of Ghana's big general-merchandise stores: five stores and a central warehouse, a catalogue that runs from rice to chest freezers, local and imported suppliers. Prices are in Ghana cedis.

The demo data is for **Akwaaba Mall**, a fictional retailer. The branch locations are real places; the company, people and suppliers are made up.

## What it does

### Stock

- **Catalogue**: products with SKUs, GTIN barcodes (the check digit is validated), categories grouped by department, shelf prices and a usual supplier. Head office adds, edits and discontinues products.
- **Stock per branch**: on hand, reorder point (a company default that a manager can override for their branch) and shelf location, drawn as a fill gauge against the reorder point.
- **Receive goods**: a goods received note (GRN) per delivery, built for barcode scanners.
  - Scan, and the line appears; scan the same item again and the quantity goes up.
  - Each line's cost updates the product's moving average cost.
  - Each receipt gets a per-branch document number, e.g. `GRN-SPX-000042`.
- **Adjustments**: write off damaged, expired, stolen or internally used stock; return found stock; or record a shelf count and let Tally work out the difference.
- **Transfers** between branches and from the warehouse. Sending takes the stock off the sender's shelf, and it's "on the way" until the receiver counts it in. A short count is recorded as lost in transit, with a note. A manager can call back a transfer still on the road.
- **Low stock**: everything at or below its reorder point, emptiest first, grouped by supplier, because that's how a reorder is placed. Each line shows what's on the way, on order and requested, and a line those will cover is marked "Covered". From here you can top up a store from the warehouse, request stock from it, or order from a supplier.
- **Movements**: a ledger of every change to stock. Nothing in it can be edited or deleted; mistakes are corrected with a new adjustment.

### Buying

- **Purchase orders**: a manager drafts one for their branch (or straight from the low-stock list), head office approves it, and staff print it or save it as a PDF for the supplier. Deliveries are received against the order, in part or in full; an order can be closed short or cancelled. Local suppliers who turn up without an order still go through the plain goods-received form.
- **Stock requests**: a store manager asks the warehouse for stock; warehouse staff fulfil the request as a transfer, sending no more than was asked.

### Selling

- **Till**: an in-app point of sale for scanners, with cash, mobile money or card, change due and quick-cash buttons, and a printed-receipt look. Ctrl/Cmd+Enter charges.
- **Sales API** for outside POS tills: `POST /api/v1/sales` with a per-till key (`Authorization: Bearer tly_…`). Head office issues and revokes keys on the Tills page; a resent sale is recognised and not counted twice. `pnpm till:simulate` posts a few test sales.
- **A sale is never refused for lack of stock.** The balance goes below zero and the line is flagged "Needs a count".
- **Returns**: a manager approves each one; each line goes back on the shelf or is written off as damaged.

### Seeing it

- **Overview**: stock value, sales today, lines that need reordering, what's on the way, best sellers, and a board of every branch (click a branch to switch to it).
- **Reports** for head office (any branch, or the company) and managers (their own branch), over the last 7, 30 or 90 days, each with a CSV download:
  - **Stock value** over time, from the ledger, plus goods in transit.
  - **Fast and slow sellers**: units, takings, margin and days of cover, net of returns, and the money tied up in lines that aren't selling.
  - **Shrinkage** by branch and cause (damaged, expired, theft, internal use, damaged returns, counts, lost in transit), as a share of cost of sales.
- **Branch switcher**: every page follows the branch you pick, or all branches.
- **Command palette** (Ctrl/Cmd+K): go to any page, create any document, find products (scan a barcode, then Enter) and documents by number (`spx-42`), switch branch, theme or sidebar. Alt+Shift+P, L, S, R or T open Products, Low stock, New sale, Receive a delivery and New transfer.

### Staff and roles

|  | Head office | Branch manager | Storekeeper | Cashier |
| --- | --- | --- | --- | --- |
| See stock | every branch | every branch | every branch | on hand and shelf prices only |
| Sell at the till | any branch | own branch | — | own store |
| Approve returns | any branch | own branch | — | — |
| Receive goods, send and receive transfers | any branch | own branch | own branch | — |
| Damaged / expired write-offs | any branch | own branch | own branch | — |
| Theft, found, internal use, counts | any branch | own branch | — | — |
| Reorder points, shelf locations, cancel a transfer | any branch | own branch | — | — |
| Draft purchase orders, request stock | any branch | own branch | — | — |
| Approve purchase orders | ✓ | — | — | — |
| Reports | every branch | own branch | — | — |
| Ask Tally | ✓ | ✓ | ✓ (no reports) | — |
| Catalogue, staff and till keys | ✓ | — | — | — |

Anything that could hide a loss needs a manager. A cashier sees the till, their store's sales and the products, and nothing else: no costs, suppliers or other branches' paperwork. Deactivating someone signs them out everywhere at once.

## Ask Tally

A read-only assistant in the command palette (Ctrl+K, then **Ask Tally** or `?`). Ask it in plain words ("What's running low at Kumasi?", "Which transfers are still on the road?", "How much stock did we lose this month?") and it answers from Tally's own figures, with links to the products and documents it mentions.

- **It never changes anything**, and it never writes SQL: the model calls tools that wrap Tally's existing queries (`lib/ask/`).
- **It sees what you see.** The tools take your role and branch from your session, never from the model. Cashiers don't get it; the report questions (sellers, shrinkage, stock value) are for head office and managers, and a manager asking about another branch's report is told no.
- **The tools do the sums.** Money comes formatted and totals added up, so the model only quotes them; answers link only to records a tool returned.
- **Limits:** 20 questions per person per hour, at most 5 tool calls and a short answer each; the conversation is gone when the palette closes.

It runs on [OpenRouter](https://openrouter.ai)'s free models. It needs **two things**: a key on the server, and head office switching it on for the company on the settings page (Settings → Ask Tally), after a consent screen that spells out what leaves the server. With either missing it appears nowhere, and `/api/ask` answers 404. The demo seed starts with it switched on.

```bash
OPENROUTER_API_KEY=sk-or-...                 # in .env.local; without it the switch can't be turned on
ASK_TALLY_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free   # optional; one id, or a comma-separated fallback list
```

Things to know before turning it on:

- **What leaves the server:** each question sends product names, stock figures, costs and branch names to OpenRouter and the model's host. Free models' hosts may log or train on prompts. Fine for the fictional demo; for real data, use a paid model whose terms you accept.
- **Free models are rate limited:** about 50 requests a day per OpenRouter account, and a question takes 2 or 3, so a busy demo can run dry (people see "Ask Tally couldn't answer just now"). Answers take 15 to 20 seconds.
- **Free models come and go.** `pnpm eval:ask` runs golden questions against any model (`pnpm eval:ask --cases rice,low,refuse some/model:free`) using fixture data, not your database; run it before switching models.

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · ui-sdk · PostgreSQL with Drizzle ORM · Better Auth · zod · AI SDK with OpenRouter (Ask Tally) · Vitest · Ultracite (Oxlint + Oxfmt)

## How it's built

| Concern | Approach |
| --- | --- |
| Stock | One ledger. Every change is a row in `stock_movement`, and `stock_level.on_hand` is the running balance, updated in the same transaction (`lib/stock/ledger.ts`). The tests check that every balance equals the sum of its movements. |
| Concurrency | Stock goes down through one conditional `UPDATE … SET on_hand = on_hand + q WHERE on_hand + q >= 0`, so two people racing for the last unit can't both win. Receipts lock product rows in id order, so they can't deadlock. |
| Money | Integers in pesewas everywhere; parsed and formatted only at the edges (`lib/money.ts`). |
| Validation | zod at every boundary: Server Actions parse form input, and the domain functions validate again, so a hand-crafted request gets no further than the form would. |
| Permissions | Plain functions in `lib/permissions.ts`, checked by every domain function. The UI uses the same functions only to hide what you can't do. |
| Auth | Better Auth with email and password; no public sign-up. There's no session cookie cache, so a deactivation or role change applies on the next click. |
| Database | PostgreSQL. Without `DATABASE_URL`, Tally runs **PGlite** (Postgres compiled to WebAssembly) in-process, so `pnpm dev` needs nothing installed. Both use the same migrations. |

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The first request migrates the local PGlite database in `.data/pglite` and seeds the demo data. The sign-in page lists demo accounts for each role; they all use the password `akwaaba-demo`.

To use a real Postgres server instead:

```bash
cp .env.example .env.local   # set DATABASE_URL and BETTER_AUTH_SECRET
pnpm db:migrate
pnpm db:seed                 # optional demo data
```

### Before going live: Terms and Privacy

Tally ships a public [terms of use](app/terms/page.tsx) and [privacy notice](app/privacy/page.tsx), linked under the sign-in form. They name the company from Settings as the data controller and refer to Ghana's Data Protection Act, 2012 (Act 843). They are a starting point, **not legal advice**: have them reviewed for your company, and replace the placeholder contact address `PRIVACY_EMAIL` in `lib/legal.ts` (and `SECURITY_EMAIL` in `lib/seo.ts`) with real ones. When the text changes, move the page's date in `lib/legal.ts`.

## Scripts

```bash
pnpm dev          # start the dev server
pnpm build        # production build
pnpm test         # run the test suite (each file gets its own in-memory Postgres)
pnpm eval:ask     # Ask Tally's golden questions against real models (spends free-tier requests)
pnpm till:simulate # post a few sales through the sales API (needs TALLY_TILL_KEY)
pnpm icons        # regenerate the favicon, app icons and manifest icons
pnpm db:generate  # create a migration after changing lib/db/schema.ts
pnpm db:migrate   # apply migrations to DATABASE_URL (or the local PGlite)
pnpm db:seed      # load the demo data into an empty database
pnpm db:reset     # wipe and reseed (stop the dev server first; needs --yes for a real server)
pnpm typecheck    # tsc --noEmit
pnpm check        # lint + format check (Ultracite)
```

## Testing

`pnpm test` runs about 370 tests in 46 files, the database ones against real Postgres (PGlite, in memory, a fresh one per file). They cover:

- the ledger: every balance equals the sum of its movements after receiving, adjusting, transferring, selling, returning and seeding, and two people racing for the last units can't both win;
- each document's rules: per-branch numbering, moving average cost, short transfer receipts, over-delivery against an order, requests fulfilled as transfers, returns, and a resent till sale counted once;
- reports worked through by hand for one product's month, and the CSVs;
- the permission matrix, and cashiers seeing nothing beyond their store;
- the command palette, the till and the forms, rendered in a DOM;
- Ask Tally: every tool against a fake data port (which branch each role reached, and refusals that read nothing), the model loop against a mock model, and the panel.

## What's next

- A settings page, with a head-office switch (behind a consent screen) for Ask Tally.
- Ask Tally: pre-filled links to act on an answer (a stock request, a top-up), and any date range rather than 7, 30 or 90 days.
