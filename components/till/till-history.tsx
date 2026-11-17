"use client";

import { and, eq, gte, lt, useLiveQuery } from "@tanstack/react-db";
import { CalendarX, SearchX } from "lucide-react";
import { useState } from "react";

import { SaleRow } from "@/components/till/sale-row";
import { useTillData } from "@/components/till/till-data-provider";
import { Button } from "@/components/ui/button";
import { EmptyNote } from "@/components/ui/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { labelledOptions, namedOptions } from "@/components/ui/select-options";
import type { PaymentMethod } from "@/lib/db/schema";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/stock/payment";
import { DAY_MS } from "@/lib/time";

const PAGE = 20;

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

/** Ghana keeps GMT all year, so a calendar day is a UTC day. */
const todayInAccra = (): string => new Date().toISOString().slice(0, 10);

const dayWindow = (day: string) => {
  const start = new Date(`${day}T00:00:00.000Z`);

  return {
    from: start.toISOString(),
    to: new Date(start.getTime() + DAY_MS).toISOString(),
  };
};

interface Option {
  readonly id: string;
  readonly name: string;
}

/** The sales panel with no rows: still loading, or none for this day. */
const NoSales = ({
  loading,
  byPayment,
}: {
  readonly loading: boolean;
  readonly byPayment: boolean;
}) => {
  if (loading) {
    return <p className="text-ink-2 p-4 text-sm">Loading…</p>;
  }

  if (byPayment) {
    return (
      <EmptyNote icon={SearchX} title="No sales match">
        Try another day or payment method.
      </EmptyNote>
    );
  }

  return (
    <EmptyNote icon={CalendarX} title="No sales on this day">
      Pick another day to see its sales.
    </EmptyNote>
  );
};

/**
 * A store's recorded sales for one day, from the on-demand history
 * collection. The filters and the sort are the live query; the collection
 * turns them into one bounded request to the server each time they change,
 * and "Show more" only raises the limit. Nothing here is downloaded ahead.
 */
export const TillHistory = ({
  stores,
  defaultStoreId,
}: {
  readonly stores: readonly Option[];
  readonly defaultStoreId: string;
}) => {
  const { history } = useTillData();
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [day, setDay] = useState(todayInAccra);
  const [payment, setPayment] = useState<Payment>("all");
  const [order, setOrder] = useState<Order>("newest");
  const [limit, setLimit] = useState(PAGE);
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

  // New filters start again from the first page.
  const refilter = (change: () => void) => {
    change();
    setLimit(PAGE);
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

      <Panel flush title="Sales">
        {isLoadingError ? (
          <p className="text-danger p-4 text-sm">
            Tally couldn&apos;t load these sales. Check the connection.
          </p>
        ) : null}
        {!isLoadingError && sales.length === 0 ? (
          <NoSales byPayment={payment !== "all"} loading={isLoading} />
        ) : null}
        {sales.length > 0 ? (
          <ul>
            {sales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} />
            ))}
          </ul>
        ) : null}
      </Panel>

      {sales.length >= limit ? (
        <div>
          <Button
            onClick={() => {
              setLimit((current) => current + PAGE);
            }}
            size="md"
            type="button"
            variant="outline"
          >
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  );
};
