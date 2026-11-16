# The till's data layer: TanStack DB

How the till keeps its data in the browser, charges sales optimistically, keeps charging without a connection, and reads a long history on demand. Read it before you move another screen onto collections. The decisions and their reasons are in `docs/CONTEXT.md` ("Till data layer"); this file is the how.

Everything here is **client-side and scoped to the till** (`/till`, `/till/history`). The rest of Tally is still server components and server actions, and that is deliberate: a collection earns its place where the browser needs the data itself, to join it, change it before the server answers, or keep it through a dropped connection. A report that renders once doesn't need one.

## The map

| Layer | Where | What it does |
| --- | --- | --- |
| Shapes | `lib/till/schema.ts`, `lib/till/history-contract.ts` | zod schemas both sides import: rows, request bodies, replies, the history allow-list. Free of the database schema, so the browser can bundle them. No cost field anywhere. |
| Endpoints | `app/api/till/*`, `lib/till/api.ts`, `lib/till/caller.ts` | Route handlers (not server actions) over session auth. Logic takes `(db, actor, input)` so tests pass an in-memory database. |
| Collections | `lib/till/client/collections.ts`, `history.ts`, `attention.ts` | Eager `products`, `stockLevels`, `sales`; on-demand `history`; local `attention`. |
| Mutations | `lib/till/client/charge.ts`, `sync.ts` | The optimistic step, the request, the confirmation; the offline queue around them. |
| One per person | `lib/till/client/data.ts` | Builds the QueryClient, collections and queue once, on `globalThis`. |
| React | `components/till/*` | `TillDataProvider` (client only, waits for data and queue), live-query hooks and panels. |

Versions are pinned exactly in `package.json` (`@tanstack/db` and `@tanstack/react-db` are release candidates). The skill docs shipped inside the packages (`node_modules/@tanstack/*/skills/`) are older than the code in places: check the `.d.ts` files before trusting them.

## Step 0: the workflow you start from

A typical TanStack Query screen fetches a REST endpoint into a per-hook cache:

```tsx
const { data: products = [] } = useQuery({
  queryKey: ["till", "products"],
  queryFn: async ({ signal }) =>
    (await requestJson("/api/till/catalogue", tillCatalogueReply, { signal }))
      .products,
  staleTime: 5 * 60_000,
});

// …and every screen that needs on-hand fetches levels too, then joins in render:
const onHand =
  levels.find((l) => l.branchId === store && l.productId === id)?.onHand ?? 0;
```

That works until two things matter: combining data from several endpoints (each hook re-renders and re-joins in JavaScript), and changing data before the server answers (you hand-edit each cache with `setQueryData` and hand-roll the rollback).

## Step 1: adopt collections, keep the endpoint

You don't change the backend. The same `queryKey` and `queryFn` move into `queryCollectionOptions`, and the rows land in a typed collection instead of a hook's cache (`lib/till/client/collections.ts`):

```ts
const products = createCollection(
  queryCollectionOptions({
    id: "till-products", // stable: the offline queue finds collections by id
    queryClient,
    queryKey: ["till", "products"], // the same key the useQuery used
    queryFn: async ({ signal }) =>
      await requestJson("/api/till/catalogue", tillCatalogueReply, { signal }),
    select: (reply) => reply.products, // rows out of the reply's shape
    schema: tillProduct, // zod is a Standard Schema: inserts are validated
    getKey: (item) => item.id,
    staleTime: 5 * 60_000,
  })
);
```

This is **eager** mode (the default): `queryFn` returns the whole set, and the collection holds all of it. Right for the catalogue and the store's shelf counts, which the till needs in full to scan without a server.

Then **read with live queries**, which are incremental: they update when any source row changes, without re-running the join. The basket's prices and counts are a join across two collections (`components/till/use-basket-shelf.ts`):

```ts
const atStore = q
  .from({ level: stockLevels })
  .where(({ level }) => eq(level.branchId, storeId));

q.from({ product: products })
  .leftJoin({ level: atStore }, ({ product, level }) =>
    eq(product.id, level.productId)
  )
  .where(({ product }) => inArray(product.id, [...productIds]))
  .select(({ product, level }) => ({
    id: product.id,
    onHand: coalesce(level?.onHand, 0),
    sellPrice: product.sellPrice,
  }));
```

Rules that bit us:

- **Use the query operators** (`eq`, `gte`, `inArray`), never `===`, inside `where`. Joins take equality only; put "field = literal" in `where`, or join a filtered subquery, as above.
- **Index what live queries filter, join and sort by** (`collection.createIndex`). Without one, TanStack DB warns in the console and scans. For a sort, the index must use the query's compare options, or it is ignored (see Step 3).
- **Make one set of collections per person, not per render.** `getTillData(userId)` keeps them on `globalThis`, so StrictMode's double render and hot reload reuse them. Never build collections at import time (the server would run them) or in a component body.
- **The provider renders nothing from collections on the server.** `TillDataProvider` gets the data layer through `useSyncExternalStore` with a `null` server snapshot, shows "Loading the till…", and only renders children once the collections are ready. The packages' docs say there is no SSR; the rc does export `DbProvider` and `HydrationBoundary`, but we don't use them.

### Optimistic mutations with rollback

A mutation is two halves: a **synchronous optimistic step** that changes collections at once, and an **async persist** that tells the server. The till's charge changes two collections in one transaction (`lib/till/client/charge.ts`):

```ts
export const applyCharge = ({ sales, stockLevels }, input) => {
  sales.insert(draftSale(input, new Date())); // id and number null until confirmed
  for (const line of input.lines) {
    const key = stockLevelKey(input.branchId, line.productId);
    if (stockLevels.has(key)) {
      // updating a missing key throws
      stockLevels.update(key, (draft) => {
        draft.onHand -= line.quantity;
      });
    }
  }
};
```

Run through `createOptimisticAction` (how batch 2 shipped it) or a transaction's `mutate()`, both changes show immediately. If the persist step throws, **both roll back** together.

The persist step must **write the server's answer into the collections before it returns**. When it returns, the optimistic layer is dropped; if the synced data underneath is still the old data, the screen flickers back. Either refetch, or write the confirmed rows, which is cheaper when the endpoint returns them:

```ts
export const confirmCharge = async ({ sales, stockLevels }, reply) => {
  await sales.utils.writeUpsert(reply.sale); // writeUpsert/writeBatch return promises in the rc
  if (reply.levels.length > 0) {
    await stockLevels.utils.writeUpsert(reply.levels);
  }
};
```

Two choices make this clean:

- **Key the row by an id the browser chooses.** Sales are keyed by `clientRef`, which the till makes up when the cashier presses Charge. The optimistic row and the confirmed row are the same row, so nothing has to swap a temporary id for a real one.
- **The browser never decides anything the server owns.** The POST carries product ids and quantities; the server prices it from the shelf and moves stock through `applyMovement`. The optimistic on-hand is a display. `expectedTotal` travels along only so a price changed in between is flagged on the sale.

## Step 2: offline transactions

`@tanstack/offline-transactions` adds an outbox: a transaction is stored in the browser (IndexedDB) before it is sent, retried with backoff, and replayed (optimistic rows and all) after a reload. `lib/till/client/sync.ts` wraps the same `applyCharge` / `postCharge` / `confirmCharge` in it.

```ts
const transaction = executor.createOfflineTransaction({
  mutationFnName: "recordSale",
  idempotencyKey: input.clientRef, // the server is idempotent on (branch, clientRef)
  metadata: { charge: input }, // stored with it, handed back on replay
  autoCommit: false,
});
transaction.mutate(() => applyCharge(collections, input));
const settled = transaction.commit();
```

What we learned, in the order it matters:

1. **The server must be idempotent first.** Replays happen (a reload, a retry after a timeout that actually succeeded). `recordSale` returns the first sale for a repeated `clientRef`; the queue's `idempotencyKey` is the same value.
2. **Rebuild the request from `metadata`, never from closures.** After a reload the mutation function runs in a fresh page. Parse the metadata again (`tillCharge.parse`): it comes back out of storage.
3. **`commit()` waits for the server.** Awaiting it would freeze the till while offline. The till races it against "the outbox holds this transaction" (polling `peekOutbox`), plus a few seconds' grace while online. Then it either has the sale's number or tells the cashier "Saved on this till".
4. **Classify every failure yourself.** The default retry policy guesses from the error message. `shouldRetry: () => true`, and permanent refusals (`TillHttpError.refused`: a status in `REFUSED_STATUSES`, `lib/http.ts`, in Tally's own JSON; a 4xx page from a proxy is retried) throw a `NonRetriableError` subclass. Retries back off from 1 s to 60 s, forever, which is right for a sale.
5. **A refusal after the customer has gone must not vanish.** The queue drops a refused transaction and rolls back its optimistic rows. If the cashier is still waiting, that's an error on screen. If not, the sale is copied first to a `localStorageCollectionOptions` "needs attention" list that a manager clears.
6. **Use route handlers, not server actions, as the mutation endpoint.** A replay after the session ends must get a JSON 401 it can wait on, not a redirect to the sign-in page that `fetch` would follow and call success. Server action ids also change between deploys. The proxy lets `/api/till` through for the same reason, and `requestJson` sends `redirect: "error"`.
7. **One outbox per person.** The IndexedDB name and the Web Lock name carry the user id. The server also refuses a sale whose `cashierId` isn't the person signed in (401 `wrong_user`, held, never re-attributed). Signing out with sales queued warns, and keeps them for that person's next sign-in on the device.
8. **Start the executor after the collections have loaded.** Restoring a queued sale updates rows in `stockLevels`; on an empty collection there's nothing to update.
9. **Don't use the default online detector.** `WebOnlineDetector` treats a visible tab as online and ignores the `offline` event. `lib/till/client/online.ts` trusts `navigator.onLine`, both events, and visibility.
10. **Only one tab sends.** Other tabs (and browsers with no storage) fall back to plain online transactions; `isOfflineEnabled` says which, and the status line tells the cashier.

## Step 3: on-demand sync, when the backend can filter

Eager is wrong for something long, like a store's every sale. If the endpoint can filter, sort and page, switch the collection to **on-demand**: it loads nothing up front, and each live query's `where` / `orderBy` / `limit` / `offset` arrives in `queryFn` as `meta.loadSubsetOptions` (`lib/till/client/history.ts`):

```ts
createCollection(
  queryCollectionOptions({
    id: "till-sale-history",
    syncMode: "on-demand",
    // Simplified: the real builder returns the bare base key for an empty subset.
    queryKey: (subset) => [
      ...HISTORY_KEY,
      historySearchParams(subset).toString(),
    ],
    queryFn: async ({ meta, signal }) =>
      await requestJson(
        `/api/till/sales/history?${historySearchParams(meta?.loadSubsetOptions)}`,
        historyReply,
        { signal }
      ),
    select: (reply) => reply.sales,
    getKey: (item) => item.id,
    schema: historySale,
  })
);
```

The component just writes the query it wants, and "Show more" is only a bigger `limit`:

```ts
q.from({ sale: history })
  .where(({ sale }) =>
    and(
      eq(sale.branchId, storeId),
      gte(sale.createdAt, from),
      lt(sale.createdAt, to)
    )
  )
  .orderBy(({ sale }) => sale.createdAt, {
    direction: "desc",
    stringSort: "lexical",
  })
  .limit(limit);
```

Design the backend half first, as an **allow-list both sides import** (`lib/till/history-contract.ts`). Map `parseLoadSubsetOptions` output field by field (`branchId.eq`, `createdAt.gte`, …), and **throw on anything unmapped**. A filter dropped under a `limit` returns the wrong page, which is worse than an error. Keep every derived `queryKey` under the base key, so invalidating the base reaches every subset.

What on-demand mode actually asks for (we found these the hard way, and each has a test in `lib/till/client/history.test.ts`):

- **A page, then the ties at its edge.** After a window of `limit` rows, core asks for "every row equal to the last sort value" so a tie can't fall between pages. Support equality on every sort field (`createdAt.eq`, `total.eq`).
- **String sorts must be lexical.** The default sort is locale-aware, which a server can't reproduce, so core gives up on cursors and asks for every matching row. ISO timestamps sort correctly as plain strings, so order times with `stringSort: "lexical"`. Core labels even a numeric sort "locale", so check collation only on string fields.
- **A short page asks for the whole window.** When a filter leaves fewer rows than the limit (a quiet day, "Cash only"), core may request the full filtered set with no limit. Allow that only when the window is bounded (a time range, or an exact value). Have the server return up to a hard cap and **error past it** rather than truncating (`HISTORY_WINDOW_MAX`).
- **Offsets arrive outside `parseLoadSubsetOptions`.** It returns filters, sorts and limit; read `subset.offset` yourself. `cursor` expressions also arrive separately; with offsets you can ignore them.
- **Indexes must match the query's compare options**, or they are skipped: `createIndex(fn, { indexType: BasicIndex, options: { compareOptions: { direction: "asc", nulls: "first", stringSort: "lexical" } } })`.
- **`preload()` on an on-demand collection does nothing.** Preload a live query instead.

## Testing it

Vitest runs in Node, with no IndexedDB, Web Locks or real network, and that's enough:

- **Endpoints:** test the `lib/till/api.ts` functions against `createTestWorld()` (in-memory PGlite, real migrations), with `ledgerMismatches` and `saleMismatches` after every write.
- **Collections:** build them with a real `QueryClient` and `vi.stubGlobal("fetch", …)`. Assert on `collection.get(key)` before and after the stubbed answer to see optimistic, confirmed and rolled-back states.
- **The queue:** `createTillSync` takes its plumbing: an in-memory `StorageAdapter`, a leader that always leads, and an online detector the test switches. "Reload" means disposing one till and building another on the same storage (`lib/till/client/sync.test.ts`).
- **On-demand:** build real live queries over the collection and assert on the query strings the stubbed `fetch` received, and on what it refused.

## Adopting the next screen

1. **Does the browser need the data itself** (join it, change it optimistically, keep it offline)? If not, leave it a server component.
2. **Write the shapes** as zod schemas both sides import, free of `lib/db/schema` imports, with no cost fields unless every viewer may see them.
3. **Add route handlers** with logic in a `(db, actor, input)` function that checks permissions, as every domain function does. Writes go through the existing domain functions (the ledger, `canSell`, …), never around them.
4. **Eager collection** with the screen's old `queryKey` and `queryFn`, registered in `getTillData` (or a sibling per-person module), with a stable `id` and indexes for its live queries.
5. **Mutations:** a synchronous optimistic step, a request with a key the browser chose, and a confirmation written before settling. An offline queue only for writes the server accepts idempotently.
6. **On-demand** when the set is too big to hold, and only once the endpoint has an allow-list.

## Not done

- **Saying how old the offline copy is.** `public/till-sw.js` lets `/till` open from cold without a connection (see `docs/CONTEXT.md`, "Till offline start"); each saved answer carries `X-Tally-Saved-At`, but the till doesn't show it yet. Browser SQLite (`@tanstack/browser-db-sqlite-persistence`) stays an option if the catalogue outgrows a cached JSON reply; it would need `'wasm-unsafe-eval'` in the CSP.
- **SSR of collections.** The rc has `DbProvider` / `HydrationBoundary`; the till renders a loading line on the server instead.
- **Other screens.** Products, low stock and transfers are still server-rendered.
