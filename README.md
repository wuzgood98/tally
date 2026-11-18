# Tally

[![CI](https://github.com/wuzgood98/tally/actions/workflows/ci.yml/badge.svg)](https://github.com/wuzgood98/tally/actions/workflows/ci.yml) [![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

Stock control for a multi-branch retailer at the scale of Ghana's big general-merchandise stores: five stores and a central warehouse, a catalogue that runs from rice to chest freezers, local and imported suppliers. Prices are in Ghana cedis.

**Try it: [tally.g14o.dev](https://tally.g14o.dev).** The sign-in page lists a demo account for every role (head office, branch manager, storekeeper, cashier), all with the password `akwaaba-demo`. The demo data is for **Akwaaba Mall**, a fictional retailer: the branch locations are real places, but the company, people and suppliers are made up.

- [What it does](#what-it-does)
- [Ask Tally](#ask-tally)
- [Stack](#stack)
- [How it's built](#how-its-built)
- [Running it](#running-it)
- [Deploying](#deploying)
- [Scripts](#scripts)
- [Testing and CI](#testing-and-ci)
- [Documentation](#documentation)
- [License](#license)

## What it does

### Stock

- **Catalogue**: products with SKUs, GTIN barcodes (the check digit is validated), categories grouped by department, shelf prices and a usual supplier. Head office adds, edits and discontinues products.
- **Stock per branch**: on hand, reorder point (a company default that a manager can override for their branch) and shelf location, drawn as a fill gauge against the reorder point, with what's on the way hatched in.
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
- **The till works offline.** Charging carries on through a dropped connection: sales wait in an outbox on the device and go to Tally when it's back, surviving a reload or a crash. Once someone has opened the till online, a service worker lets it open from cold with no connection, and the status line says how old its prices and counts are. A sale Tally refuses after the customer has gone lands on a "Needs a manager" list. Signing out warns about sales not yet sent and clears the saved copy.
- **Sales API** for outside POS tills: `POST /api/v1/sales` with a per-till key (`Authorization: Bearer tly_…`). Head office issues and revokes keys on the Tills page; a resent sale is recognised and not counted twice. `pnpm till:simulate` posts a few test sales.
- **A sale is never refused for lack of stock.** The balance goes below zero and the line is flagged "Needs a count".
- **Returns**: a manager approves each one; each line goes back on the shelf or is written off as damaged.

### Seeing it

- **Overview**: stock value, sales today, lines that need reordering, what's on the way, best sellers, and a board of every branch (click a branch to switch to it).
- **Reports** for head office (any branch, or the company) and managers (their own branch), over the last 7, 30 or 90 days, each with a CSV download:
  - **Stock value** over time, from the ledger, plus goods in transit.
  - **Fast and slow sellers**: units, takings, margin and days of cover, net of returns, and the money tied up in lines that aren't selling.
  - **Shrinkage** by branch and cause (damaged, expired, theft, internal use, damaged returns, counts, lost in transit), as a share of cost of sales.
- **Notifications**: a bell for hand-offs that concern you, from someone else. A store hears when stock is sent its way or an order is approved; head office hears about drafts to approve and losses in transit; managers hear about new requests and cancellations. Standing counts (drafts to approve, open requests) are badges in the navigation instead.
- **Branch switcher**: every page follows the branch you pick, or all branches.
- **Command palette** (Ctrl/Cmd+K): go to any page, create any document, find products (scan a barcode, then Enter) and documents by number (`spx-42`), switch branch, theme or sidebar. Alt+Shift+P, L, S, R or T open Products, Low stock, New sale, Receive a delivery and New transfer.

### Staff, settings and the app itself

- **Staff**: head office adds people, sets their role and branch, and deactivates them, which signs them out everywhere at once. There's no public sign-up.
- **Settings**: everyone gets a staff badge (rename yourself, change your password, turn the badge over), a theme (light, dark or your device's) and the sidebar style. Head office also sets the company name, the default reorder point, the receipt footer and Ask Tally's switch.
- **Installable**: Tally can be installed as an app, with shortcuts to the till, low stock and receiving goods. Light and dark themes throughout, and every screen works on a phone.
- **Public pages**: only sign-in, Terms and Privacy are meant to be found by search engines; everything else is marked `noindex` and blocked in `robots.txt`.

### Who can do what

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
| Catalogue, staff, till keys, company settings | ✓ | — | — | — |

Anything that could hide a loss needs a manager. A cashier sees the till, their store's sales and the products, and nothing else: no costs, suppliers or other branches' paperwork.

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

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · ui-sdk · PostgreSQL with Drizzle ORM · Better Auth · zod · TanStack DB (the till's offline data) · AI SDK with OpenRouter (Ask Tally) · Vitest · Ultracite (Oxlint + Oxfmt) · GitHub Actions

## How it's built

| Concern | Approach |
| --- | --- |
| Stock | One ledger. Every change is a row in `stock_movement`, and `stock_level.on_hand` is the running balance, updated in the same transaction (`lib/stock/ledger.ts`). The tests check that every balance equals the sum of its movements. |
| Concurrency | Stock goes down through one conditional `UPDATE … SET on_hand = on_hand + q WHERE on_hand + q >= 0`, so two people racing for the last unit can't both win. Receipts lock product rows in id order, so they can't deadlock. |
| Money | Integers in pesewas everywhere; parsed and formatted only at the edges (`lib/money.ts`). |
| Validation | zod at every boundary: Server Actions parse form input, and the domain functions validate again, so a hand-crafted request gets no further than the form would. |
| Permissions | Plain functions in `lib/permissions.ts`, checked by every domain function. The UI uses the same functions only to hide what you can't do. |
| Auth | Better Auth with email and password; no public sign-up. There's no session cookie cache, so a deactivation or role change applies on the next click. |
| Notifications | Written in the same transaction as the change they report, after its conditional update, so a lost race or a failed action tells no one. |
| The till | Server components everywhere else; the till alone keeps its data in the browser (TanStack DB collections), charges optimistically, queues sales in an offline outbox, and a service worker caches what it needs to open with no connection. `docs/data-layer.md` explains it. |
| Database | PostgreSQL. Without `DATABASE_URL`, Tally runs **PGlite** (Postgres compiled to WebAssembly) in-process, so `pnpm dev` needs nothing installed. Both use the same migrations. |

## Running it

You need Node.js 24 and pnpm 11 (`corepack enable` picks up the version in `package.json`).

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The first request migrates the local PGlite database in `.data/pglite` and seeds the demo data (about a minute). The sign-in page lists demo accounts for each role; they all use the password `akwaaba-demo`.

To use a real Postgres server instead:

```bash
cp .env.example .env.local   # set DATABASE_URL and BETTER_AUTH_SECRET
pnpm exec tsx --env-file=.env.local scripts/migrate.ts
pnpm db:seed                 # optional demo data
```

`.env.example` documents every variable. Only one process may open `.data/pglite` at a time, so stop the dev server before `pnpm db:reset`.

## Deploying

The live demo runs on Vercel with a Supabase Postgres database. Any Node host works the same way:

- **A database URL is required.** PGlite can't run on a serverless host, and a Vercel build without `DATABASE_URL` (or the `POSTGRES_URL` that Vercel's Supabase and Neon integrations set) stops with instructions.
- Set `BETTER_AUTH_SECRET` (any long random string) and `BETTER_AUTH_URL` (the public URL).
- If your database host signs with a certificate authority Node doesn't trust (Supabase does), put it in `DATABASE_CA_CERT`.
- Migrate before the first start, and seed only if you want the demo data. `TALLY_DEMO=true` lists the demo accounts on the sign-in page.

### Before going live: Terms and Privacy

Tally ships a public [terms of use](app/terms/page.tsx) and [privacy notice](app/privacy/page.tsx), linked under the sign-in form. They name the company from Settings as the data controller and refer to Ghana's Data Protection Act, 2012 (Act 843). They are a starting point, **not legal advice**: have them reviewed for your company, and replace the placeholder contact address `PRIVACY_EMAIL` in `lib/legal.ts` (and `SECURITY_EMAIL` in `lib/seo.ts`) with real ones. When the text changes, move the page's date in `lib/legal.ts`.

## Scripts

```bash
pnpm dev          # start the dev server
pnpm build        # production build
pnpm test         # run the test suite (each file gets its own in-memory Postgres)
pnpm typecheck    # tsc --noEmit
pnpm check        # lint + format check (Ultracite)
pnpm fix          # fix what Ultracite can
pnpm eval:ask     # Ask Tally's golden questions against real models (spends free-tier requests)
pnpm till:simulate # post a few sales through the sales API (needs TALLY_TILL_KEY)
pnpm icons        # regenerate the favicon, app icons and manifest icons
pnpm db:generate  # create a migration after changing lib/db/schema.ts
pnpm db:migrate   # apply migrations to the local PGlite (see Running it for a real server)
pnpm db:seed      # load the demo data into an empty database
pnpm db:reset     # wipe and reseed (stop the dev server first; needs --yes for a real server)
```

## Testing and CI

`pnpm test` runs the suite: 70 test files, the database ones against real Postgres (PGlite, in memory, a fresh one per file). They cover:

- the ledger: every balance equals the sum of its movements after receiving, adjusting, transferring, selling, returning and seeding, and two people racing for the last units can't both win;
- each document's rules: per-branch numbering, moving average cost, short transfer receipts, over-delivery against an order, requests fulfilled as transfers, returns, and a resent till sale counted once;
- reports worked through by hand for one product's month, and the CSVs;
- the permission matrix, and cashiers seeing nothing beyond their store;
- who hears about what in notifications;
- the till offline: queued sales sent once on reconnect, restored after a reload, refusals routed to a manager, and the service worker opening the till from cold;
- the command palette, the till, settings and the forms, rendered in a DOM;
- Ask Tally: every tool against a fake data port (which branch each role reached, and refusals that read nothing), the model loop against a mock model, and the panel.

[GitHub Actions](.github/workflows/ci.yml) runs lint and typecheck, the tests and a production build on every pull request and every push to `main`. A pre-commit hook (Husky and lint-staged) runs `ultracite fix` on the files you commit.

## Documentation

- [`docs/CONTEXT.md`](docs/CONTEXT.md): the decisions, data model, rules the code depends on, and gotchas. Read it before changing anything.
- [`docs/data-layer.md`](docs/data-layer.md): how the till's offline data layer works, and how to move another screen onto it.
- [`AGENTS.md`](AGENTS.md): the coding standards, for people and for coding agents.

## License

Tally is free software under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).

You may use, study, change and share it, commercially or not. In return, if you distribute Tally or a modified version, **or run a modified version as a service that other people use over a network**, you must make your complete source code available to them under the same licence. In short: use it freely, but keep it open, as Tally is.
