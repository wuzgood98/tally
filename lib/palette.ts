import {
  canDraftPurchaseOrder,
  canManageCatalogue,
  canManageStaff,
  canManageTills,
  canRequestStock,
  canViewReports,
  operableBranchIds,
  sellableBranchIds,
} from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import type { BranchSummary } from "@/lib/scope";

export type PaletteIcon =
  | "adjustments"
  | "movements"
  | "overview"
  | "products"
  | "purchase-orders"
  | "receipts"
  | "reports"
  | "requests"
  | "sales"
  | "shrinkage"
  | "sellers"
  | "sign-out"
  | "low-stock"
  | "staff"
  | "stock-value"
  | "till"
  | "tills"
  | "transfers";

interface PaletteCommandBase {
  /** Unique across the palette: what `Command` reports when it runs. */
  readonly value: string;
  readonly label: string;
  readonly icon: PaletteIcon;
  readonly keywords?: readonly string[];
}

export interface PaletteLink extends PaletteCommandBase {
  readonly kind: "link";
  readonly href: string;
}

export interface PaletteSignOut extends PaletteCommandBase {
  readonly kind: "sign-out";
}

export type PaletteCommand = PaletteLink | PaletteSignOut;

/** Always the last group: the branch switcher goes just above it. */
export const ACCOUNT_GROUP = "Account";

export interface PaletteGroup {
  readonly label: string;
  readonly commands: readonly PaletteCommand[];
}

const link = (
  value: string,
  label: string,
  href: string,
  icon: PaletteIcon,
  keywords?: readonly string[]
): PaletteLink => ({ href, icon, keywords, kind: "link", label, value });

const goTo = (viewer: Actor, sellsSomewhere: boolean): PaletteCommand[] => {
  const reports = canViewReports(viewer);

  return [
    link("go:/", "Overview", "/", "overview", ["home", "dashboard"]),
    ...(sellsSomewhere
      ? [link("go:/till", "Till", "/till", "till", ["sell", "checkout", "pos"])]
      : []),
    link("go:/sales", "Sales", "/sales", "sales", ["receipts", "returns"]),
    link("go:/products", "Products", "/products", "products", ["catalogue"]),
    link("go:/low-stock", "Low stock", "/low-stock", "low-stock", [
      "reorder",
      "out of stock",
    ]),
    link("go:/receipts", "Receive goods", "/receipts", "receipts", [
      "grn",
      "deliveries",
      "goods received",
    ]),
    link("go:/transfers", "Transfers", "/transfers", "transfers", ["trf"]),
    link("go:/requests", "Requests", "/requests", "requests", [
      "stock requests",
      "req",
    ]),
    link("go:/adjustments", "Adjustments", "/adjustments", "adjustments", [
      "counts",
      "write-off",
    ]),
    link("go:/movements", "Movements", "/movements", "movements", [
      "ledger",
      "history",
    ]),
    link(
      "go:/purchase-orders",
      "Purchase orders",
      "/purchase-orders",
      "purchase-orders",
      ["po", "suppliers"]
    ),
    ...(reports
      ? [
          link("go:/reports", "Reports", "/reports", "reports"),
          link(
            "go:/reports/stock-value",
            "Stock value over time",
            "/reports/stock-value",
            "stock-value",
            ["report", "valuation"]
          ),
          link(
            "go:/reports/sellers",
            "Fast and slow sellers",
            "/reports/sellers",
            "sellers",
            ["report", "best sellers"]
          ),
          link(
            "go:/reports/shrinkage",
            "Shrinkage",
            "/reports/shrinkage",
            "shrinkage",
            ["report", "losses", "theft"]
          ),
        ]
      : []),
    ...(canManageStaff(viewer)
      ? [link("go:/staff", "Staff", "/staff", "staff", ["people", "accounts"])]
      : []),
    ...(canManageTills(viewer)
      ? [link("go:/tills", "Tills", "/tills", "tills", ["api keys", "pos"])]
      : []),
  ];
};

const create = (
  viewer: Actor,
  branches: readonly BranchSummary[],
  sellsSomewhere: boolean
): PaletteCommand[] => {
  const handlesStock =
    operableBranchIds(
      viewer,
      branches.map((item) => item.id)
    ).length > 0;

  const drafts = branches.some((item) =>
    canDraftPurchaseOrder(viewer, item.id)
  );

  const requests =
    branches.some((item) => item.kind === "warehouse") &&
    branches.some(
      (item) => item.kind === "store" && canRequestStock(viewer, item.id)
    );

  return [
    ...(sellsSomewhere
      ? [link("new:sale", "New sale", "/till", "till", ["sell", "ring up"])]
      : []),
    ...(handlesStock
      ? [
          link(
            "new:receipt",
            "Receive a delivery",
            "/receipts/new",
            "receipts",
            ["receive goods", "new receipt", "grn", "delivery"]
          ),
          link(
            "new:adjustment",
            "New adjustment",
            "/adjustments/new",
            "adjustments",
            ["count", "write off", "damaged"]
          ),
          link("new:transfer", "New transfer", "/transfers/new", "transfers", [
            "send stock",
          ]),
        ]
      : []),
    ...(drafts
      ? [
          link(
            "new:purchase-order",
            "New purchase order",
            "/purchase-orders/new",
            "purchase-orders",
            ["po", "order from supplier"]
          ),
        ]
      : []),
    ...(requests
      ? [
          link(
            "new:request",
            "New stock request",
            "/requests/new",
            "requests",
            ["ask warehouse"]
          ),
        ]
      : []),
    ...(canManageCatalogue(viewer)
      ? [
          link("new:product", "New product", "/products/new", "products", [
            "add product",
          ]),
        ]
      : []),
  ];
};

/**
 * What the palette offers this person before they type. It mirrors the nav
 * and the guards on each page, so no command leads to a page they can't use.
 */
export const paletteCommands = (
  viewer: Actor,
  branches: readonly BranchSummary[]
): PaletteGroup[] => {
  const sellsSomewhere =
    sellableBranchIds(
      viewer,
      branches.flatMap((item) => (item.kind === "store" ? [item.id] : []))
    ).length > 0;

  const creatable = create(viewer, branches, sellsSomewhere);

  return [
    { commands: goTo(viewer, sellsSomewhere), label: "Go to" },
    ...(creatable.length > 0 ? [{ commands: creatable, label: "Create" }] : []),
    {
      commands: [
        {
          icon: "sign-out",
          keywords: ["log out", "logout"],
          kind: "sign-out",
          label: "Sign out",
          value: "account:sign-out",
        },
      ],
      label: ACCOUNT_GROUP,
    },
  ];
};
