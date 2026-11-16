import { describe, expect, it } from "vitest";

import { notificationDays } from "@/lib/notifications/describe";
import type { NotificationRecord } from "@/lib/notifications/describe";

const NOW = new Date("2026-11-12T15:00:00Z");

const BRANCHES = new Map([
  ["SPX", "Spintex"],
  ["KSI", "Kumasi"],
  ["TMA", "Tema Distribution Centre"],
]);

const base = {
  actorName: "Ama Mensah",
  purchaseOrder: null,
  readAt: null,
  request: null,
  transfer: null,
  units: null,
} as const;

const order = {
  branchId: "SPX",
  id: 12,
  number: "PO-SPX-000012",
  supplierName: "Kofi Supplies",
};

const transfer = {
  fromBranchId: "TMA",
  id: 7,
  number: "TRF-TMA-000007",
  requestNumber: null,
  toBranchId: "KSI",
};

const record = (
  fields: Partial<NotificationRecord> &
    Pick<NotificationRecord, "id" | "kind" | "createdAt">
): NotificationRecord => ({ ...base, ...fields });

const only = (records: NotificationRecord[]) =>
  notificationDays(records, BRANCHES, NOW)[0]?.items[0];

describe("notificationDays", () => {
  it("words each kind and links its document", () => {
    const at = new Date("2026-11-12T09:05:00Z");

    expect(
      only([
        record({
          createdAt: at,
          id: 1,
          kind: "po_drafted",
          purchaseOrder: order,
        }),
      ])
    ).toMatchObject({
      href: "/purchase-orders/12",
      number: "PO-SPX-000012",
      text: "Ama Mensah drafted an order from Kofi Supplies for Spintex, for you to approve",
      time: "09:05",
      unread: true,
    });

    expect(
      only([
        record({
          createdAt: at,
          id: 2,
          kind: "transfer_received_short",
          transfer,
          units: 3,
        }),
      ])
    ).toMatchObject({
      href: "/transfers/7",
      text: "Kumasi received it 3 units short",
    });

    expect(
      only([
        record({
          createdAt: at,
          id: 3,
          kind: "transfer_dispatched",
          transfer: { ...transfer, requestNumber: "REQ-KSI-000002" },
        }),
      ])?.text
    ).toBe(
      "Ama Mensah sent stock from Tema Distribution Centre for REQ-KSI-000002"
    );

    expect(
      only([
        record({
          actorName: null,
          createdAt: at,
          id: 4,
          kind: "request_cancelled",
          readAt: at,
          request: { branchId: "SPX", id: 2, number: "REQ-SPX-000002" },
        }),
      ])
    ).toMatchObject({
      href: "/requests/2",
      text: "Someone cancelled Spintex's request",
      unread: false,
    });
  });

  it("groups by Accra day: Today, Yesterday, then the date", () => {
    const days = notificationDays(
      [
        record({
          createdAt: new Date("2026-11-12T08:00:00Z"),
          id: 3,
          kind: "po_approved",
          purchaseOrder: order,
        }),
        record({
          createdAt: new Date("2026-11-11T23:59:00Z"),
          id: 2,
          kind: "po_approved",
          purchaseOrder: order,
        }),
        record({
          createdAt: new Date("2026-11-09T10:00:00Z"),
          id: 1,
          kind: "po_cancelled",
          purchaseOrder: order,
        }),
      ],
      BRANCHES,
      NOW
    );

    expect(days.map((day) => [day.label, day.items.length])).toEqual([
      ["Today", 1],
      ["Yesterday", 1],
      ["9 Nov", 1],
    ]);
  });

  it("drops a notification whose document is gone", () => {
    expect(
      notificationDays(
        [record({ createdAt: NOW, id: 1, kind: "po_closed" })],
        BRANCHES,
        NOW
      )
    ).toEqual([]);
  });
});
