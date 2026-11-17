"use client";

import { and, eq, gte, lt, useLiveQuery } from "@tanstack/react-db";
import { CalendarX, SearchX } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "skullet/react";

import { SaleRow } from "@/components/till/sale-row";
import {
  TillDataProvider,
  useTillData,
} from "@/components/till/till-data-provider";
import { Button } from "@/components/ui/button";
import { EmptyNote } from "@/components/ui/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { labelledOptions, namedOptions } from "@/components/ui/select-options";
import type { PaymentMethod } from "@/lib/db/schema";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/stock/payment";
import {
  HISTORY_PAGE,
  dayWindow,
  todayInAccra,
} from "@/lib/till/history-contract";
import type { TillSale } from "@/lib/till/schema";

type Payment = PaymentMethod | "all";

type Order = "newest" | "largest";

const PAYMENT_OPTIONS = [
  { label: "Every payment method", value: "all" },
  ...labelledOptions(PAYMENT_METHODS, PAYMENT_LABELS),
];

const ORDER_OPTIONS = [
  { label: "Newest first", value: "newest" },
  { label: "Largest first", value: "largest" },
];

const isPayment = (value: string): value is Payment =>
  value === "all" || PAYMENT_METHODS.some((method) => method === value);

interface Option {
  readonly id: string;
  readonly name: string;
}

interface Filters {
  readonly storeId: string;
  readonly day: string;
  readonly payment: Payment;
  readonly order: Order;
  readonly limit: number;
}

/** The sales panel with no rows for this day, or none paid this way. */
const NoSales = ({ byPayment }: { readonly byPayment: boolean }) =>
  byPayment ? (
    <EmptyNote icon={SearchX} title="No sales match">
      Try another day or payment method.
    </EmptyNote>
  ) : (
    <EmptyNote icon={CalendarX} title="No sales on this day">
      Pick another day to see its sales.
    </EmptyNote>
  );

const SalesList = ({
  sales,
  byPayment,
}: {
  readonly sales: readonly TillSale[];
  readonly byPayment: boolean;
}) =>
  sales.length === 0 ? (
    <NoSales byPayment={byPayment} />
  ) : (
    <ul>
      {sales.map((sale) => (
        <SaleRow key={sale.clientRef} sale={sale} />
      ))}
    </ul>
  );

/** Raises the limit by a page; shown while the last page came back full. */
const ShowMore = ({ onMore }: { readonly onMore?: () => void }) => (
  <div>
    <Button onClick={onMore} size="md" type="button" variant="outline">
      Show more
    </Button>
  </div>
);

/**
 * The panel while the till's data layer loads, from the first page the
 * server saw: only ever measured into its skeleton, so the real rows, and
 * "Show more" after a full page, land where their skeleton was.
 */
const SalesSample = ({ sales }: { readonly sales: readonly TillSale[] }) => (
  <div className="grid grid-cols-1 gap-6">
    <Panel flush title="Sales">
      <SalesList byPayment={false} sales={sales} />
    </Panel>
    {sales.length >= HISTORY_PAGE ? <ShowMore /> : null}
  </div>
);

/**
 * The day's sales from the on-demand history collection. The filters and the
 * sort are the live query; the collection turns them into one bounded
 * request to the server each time they change, and "Show more" only raises
 * the limit. Nothing here is downloaded ahead. While the panel has nothing
 * to show yet, Skullet draws its rows from the ones it last showed (it keeps
 * them across filter changes), or the first time from `sample`.
 */
const HistoryResults = ({
  filters: { storeId, day, payment, order, limit },
  sample,
  onMore,
}: {
  readonly filters: Filters;
  readonly sample: readonly TillSale[];
  readonly onMore: () => void;
}) => {
  const { history } = useTillData();
  const { from, to } = dayWindow(day);

  const {
    data: sales,
    isLoading,
    isLoadingError,
  } = useLiveQuery({
    query: (q) => {
      const onDay = q
        .from({ sale: history })
        .where(({ sale }) =>
          and(
            eq(sale.branchId, storeId),
            gte(sale.createdAt, from),
            lt(sale.createdAt, to)
          )
        );

      const paid =
        payment === "all"
          ? onDay
          : onDay.where(({ sale }) => eq(sale.paymentMethod, payment));

      // Lexical: ISO times sort by time as plain strings, as on the server,
      // so the collection can page with the sort value.
      const sorted =
        order === "largest"
          ? paid.orderBy(({ sale }) => sale.total, {
              direction: "desc",
              stringSort: "lexical",
            })
          : paid.orderBy(({ sale }) => sale.createdAt, {
              direction: "desc",
              stringSort: "lexical",
            });

      return sorted.limit(limit);
    },
  });

  // Rows already on screen stay while more load; only an empty panel waits.
  const waiting = isLoading && sales.length === 0;

  return (
    <div className="grid grid-cols-1 gap-6">
      <Panel flush title="Sales">
        {isLoadingError ? (
          <p className="text-danger p-4 text-sm">
            Tally couldn&apos;t load these sales. Check the connection.
          </p>
        ) : (
          <Skeleton
            data={waiting ? null : sales}
            label="Loading sales"
            sample={sample}
          >
            {(rows) => <SalesList byPayment={payment !== "all"} sales={rows} />}
          </Skeleton>
        )}
      </Panel>

      {sales.length >= limit ? <ShowMore onMore={onMore} /> : null}
    </div>
  );
};

/**
 * A store's recorded sales for one day. The filters are there at once; the
 * sales wait for the till's data layer behind a skeleton.
 */
export const TillHistory = ({
  stores,
  defaultStoreId,
  firstPage,
  userId,
}: {
  readonly stores: readonly Option[];
  readonly defaultStoreId: string;
  /** Today's newest sales at `defaultStoreId`, as the server saw them: the skeleton is drawn from these. */
  readonly firstPage: readonly TillSale[];
  readonly userId: string;
}) => {
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [day, setDay] = useState(todayInAccra);
  const [payment, setPayment] = useState<Payment>("all");
  const [order, setOrder] = useState<Order>("newest");
  const [limit, setLimit] = useState(HISTORY_PAGE);

  // The server's first page is a true sample only for the filters it was
  // read with; for others, an empty day is as good a guess as any.
  const asServerRead =
    storeId === defaultStoreId &&
    day === todayInAccra() &&
    payment === "all" &&
    order === "newest";

  // New filters start again from the first page.
  const refilter = (change: () => void) => {
    change();
    setLimit(HISTORY_PAGE);
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stores.length > 1 ? (
          <Field>
            <FieldLabel>Store</FieldLabel>
            <Select
              onValueChange={(value) => {
                refilter(() => {
                  setStoreId(value ?? defaultStoreId);
                });
              }}
              options={namedOptions(stores)}
              value={storeId}
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel>Day</FieldLabel>
          <Input
            max={todayInAccra()}
            onChange={(event) => {
              const next = event.target.value;

              if (next !== "") {
                refilter(() => {
                  setDay(next);
                });
              }
            }}
            type="date"
            value={day}
          />
        </Field>
        <Field>
          <FieldLabel>Paid by</FieldLabel>
          <Select
            onValueChange={(value) => {
              refilter(() => {
                setPayment(value !== null && isPayment(value) ? value : "all");
              });
            }}
            options={PAYMENT_OPTIONS}
            value={payment}
          />
        </Field>
        <Field>
          <FieldLabel>Order</FieldLabel>
          <Select
            onValueChange={(value) => {
              refilter(() => {
                setOrder(value === "largest" ? "largest" : "newest");
              });
            }}
            options={ORDER_OPTIONS}
            value={order}
          />
        </Field>
      </div>

      <TillDataProvider
        id="till-history"
        label="Loading sales"
        sample={<SalesSample sales={firstPage} />}
        userId={userId}
      >
        <HistoryResults
          filters={{ day, limit, order, payment, storeId }}
          sample={asServerRead ? firstPage : []}
          onMore={() => {
            setLimit((current) => current + HISTORY_PAGE);
          }}
        />
      </TillDataProvider>
    </div>
  );
};
