# Tally

Stock control for a multi-branch retailer at the scale of Ghana's big general-merchandise stores: five stores and a central warehouse, a catalogue that runs from rice to chest freezers, local and imported suppliers. Prices are in Ghana cedis.

The demo data is for **Akwaaba Mall**, a fictional retailer. The branch locations are real places; the company, people and suppliers are made up.

## Milestone 1: the core stock loop

- **Catalogue**: products with SKUs, GTIN barcodes (the check digit is validated), categories grouped by department, shelf prices and a usual supplier. Head office adds, edits and discontinues products.
- **Stock per branch**: on hand, reorder point (a company default that a manager can override for their branch) and shelf location.
- **Receive goods**: a goods received note (GRN) per delivery, built for barcode scanners.
  - Scan, and the line appears; scan the same item again and the quantity goes up.
  - Each line's cost updates the product's moving average cost.
  - Each receipt gets a per-branch document number, e.g. `GRN-SPX-000042`.
- **Adjustments**: write off damaged, expired, stolen or internally used stock; return found stock; or record a shelf count and let Tally work out the difference.
- **Low stock**: everything at or below its reorder point, emptiest first, grouped by supplier, because that's how a reorder is placed.
- **Movements**: a ledger of every change to stock. Nothing in it can be edited or deleted; mistakes are corrected with a new adjustment.
- **Overview**: stock value at cost and at shelf price, lines that need reordering, deliveries this week and a comparison across branches.
- **Staff and roles**:

  |  | Head office | Branch manager | Storekeeper |
  | --- | --- | --- | --- |
  | See stock at any branch | ✓ | ✓ | ✓ |
  | Receive goods | any branch | own branch | own branch |
  | Damaged / expired write-offs | any branch | own branch | own branch |
  | Theft, found, internal use, counts | any branch | own branch | — |
  | Reorder points and shelf locations | any branch | own branch | — |
  | Catalogue and staff | ✓ | — | — |

  Anything that could hide a loss needs a manager. Deactivating someone signs them out everywhere at once.

## Ask Tally

A read-only assistant in the command palette (Ctrl+K, then **Ask Tally** or `?`). Ask it in plain words ("What's running low at Kumasi?", "Which transfers are still on the road?", "How much stock did we lose this month?") and it answers from Tally's own figures, with links to the products and documents it mentions.

- **It never changes anything**, and it never writes SQL: the model calls tools that wrap Tally's existing queries (`lib/ask/`).
- **It sees what you see.** The tools take your role and branch from your session, never from the model. Cashiers don't get it; the report questions (sellers, shrinkage, stock value) are for head office and managers, and a manager asking about another branch's report is told no.
- **The tools do the sums.** Money comes formatted and totals added up, so the model only quotes them; answers link only to records a tool returned.
- **Limits:** 20 questions per person per hour, at most 5 tool calls and a short answer each; the conversation is gone when the palette closes.

It runs on [OpenRouter](https://openrouter.ai)'s free models and is off until a key is set:

```bash
OPENROUTER_API_KEY=sk-or-...                 # in .env.local; Ask Tally stays hidden without it
ASK_TALLY_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free   # optional; one id, or a comma-separated fallback list
```

Things to know before turning it on:

- **What leaves the server:** each question sends product names, stock figures, costs and branch names to OpenRouter and the model's host. Free models' hosts may log or train on prompts. Fine for the fictional demo; for real data, use a paid model whose terms you accept.
- **Free models are rate limited:** about 50 requests a day per OpenRouter account, and a question takes 2 or 3, so a busy demo can run dry (people see "Ask Tally couldn't answer just now"). Answers take 15 to 20 seconds.
- **Free models come and go.** `pnpm eval:ask` runs golden questions against any model (`pnpm eval:ask --cases rice,low,refuse some/model:free`) using fixture data, not your database; run it before switching models.

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL with Drizzle ORM · Better Auth · zod · Vitest · Ultracite (Oxlint + Oxfmt)

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

## Scripts

```bash
pnpm dev          # start the dev server
pnpm build        # production build
pnpm test         # run the test suite (each file gets its own in-memory Postgres)
pnpm eval:ask     # Ask Tally's golden questions against real models (spends free-tier requests)
pnpm db:generate  # create a migration after changing lib/db/schema.ts
pnpm db:migrate   # apply migrations to DATABASE_URL (or the local PGlite)
pnpm db:seed      # load the demo data into an empty database
pnpm db:reset     # wipe and reseed (stop the dev server first; needs --yes for a real server)
pnpm typecheck    # tsc --noEmit
pnpm check        # lint + format check (Ultracite)
```

## Testing

`pnpm test` runs 55 tests against real Postgres (PGlite, in memory). They cover:

- receiving: per-branch numbering, totals, moving average cost, duplicate lines, bad quantities, discontinued products and branch permissions;
- adjustments: write-offs, never going below zero (with nothing recorded on refusal), two write-offs racing for the last units, counts, and notes required for theft;
- the ledger matching every balance after all of the above, and after seeding;
- the catalogue: unique SKUs and barcodes, check digits, and who may change what;
- staff: accounts Better Auth can sign in with, readable temporary passwords, and deactivation ending every session;
- money parsing and formatting, barcode check digits and the permission matrix.

## What's next

- Transfers between branches and from the warehouse, with goods in transit.
- Point-of-sale integration, so sales take stock down as they happen.
- Purchase orders raised from the low-stock list, received against the order.
- Reports: stock valuation over time, fast and slow movers, and shrinkage by branch.
