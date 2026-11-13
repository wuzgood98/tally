import {
  ChartLine,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  Package,
  PackagePlus,
  Receipt,
  ScanBarcode,
  ScrollText,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Users,
} from "lucide-react";

import { signOut } from "@/app/login/actions";
import { TallyMark } from "@/components/brand/tally-mark";
import { NavLink } from "@/components/shell/nav-link";
import { ProductSearch } from "@/components/shell/product-search";
import { ScopeSwitcher } from "@/components/shell/scope-switcher";
import {
  canApprovePurchaseOrder,
  canDispatchTransfer,
  canManageStaff,
  canManageTills,
  canViewReports,
  sellableBranchIds,
} from "@/lib/permissions";
import { getOverviewTotals } from "@/lib/queries/overview";
import { countDraftPurchaseOrders } from "@/lib/queries/purchase-orders";
import { countOpenRequests } from "@/lib/queries/requests";
import { countIncomingInTransit } from "@/lib/queries/transfers";
import { getScope, listBranches } from "@/lib/scope";
import { requireViewer } from "@/lib/session";
import { COMPANY_NAME, ROLE_LABELS } from "@/lib/site";

const AppLayout = async ({ children }: LayoutProps<"/">) => {
  const viewer = await requireViewer();

  const [branches, scope] = await Promise.all([
    listBranches(),
    getScope(viewer),
  ]);

  // Warehouses this person sends from: their open requests are a to-do list.
  const fulfilFrom = branches.flatMap((item) =>
    item.kind === "warehouse" && canDispatchTransfer(viewer, item.id)
      ? [item.id]
      : []
  );

  const [totals, incoming, draftsToApprove, requestsToFulfil] =
    await Promise.all([
      getOverviewTotals(scope),
      countIncomingInTransit(scope),
      // Only head office approves, so only head office sees the count.
      canApprovePurchaseOrder(viewer)
        ? countDraftPurchaseOrders()
        : Promise.resolve(0),
      countOpenRequests(fulfilFrom),
    ]);

  const homeBranch = branches.find((item) => item.id === viewer.branchId);

  const sellsSomewhere =
    sellableBranchIds(
      viewer,
      branches.flatMap((item) => (item.kind === "store" ? [item.id] : []))
    ).length > 0;

  const today = (
    <>
      <NavLink href="/" icon={<LayoutDashboard />}>
        Overview
      </NavLink>
      {sellsSomewhere ? (
        <NavLink href="/till" icon={<ScanBarcode />}>
          Till
        </NavLink>
      ) : null}
      <NavLink href="/sales" icon={<Receipt />}>
        Sales
      </NavLink>
    </>
  );

  const stock = (
    <>
      <NavLink href="/products" icon={<Package />}>
        Products
      </NavLink>
      <NavLink
        badge={totals.lowLines + totals.outLines}
        href="/low-stock"
        icon={<TriangleAlert />}
        urgent
      >
        Low stock
      </NavLink>
      <NavLink href="/receipts" icon={<PackagePlus />}>
        Receive goods
      </NavLink>
      <NavLink badge={incoming} href="/transfers" icon={<Truck />}>
        Transfers
      </NavLink>
      <NavLink
        badge={requestsToFulfil}
        href="/requests"
        icon={<Inbox />}
        urgent
      >
        Requests
      </NavLink>
      <NavLink href="/adjustments" icon={<ClipboardList />}>
        Adjustments
      </NavLink>
      <NavLink href="/movements" icon={<ScrollText />}>
        Movements
      </NavLink>
    </>
  );

  const office = (
    <>
      <NavLink
        badge={draftsToApprove}
        href="/purchase-orders"
        icon={<ShoppingCart />}
        urgent
      >
        Purchase orders
      </NavLink>
      {canViewReports(viewer) ? (
        <NavLink href="/reports" icon={<ChartLine />}>
          Reports
        </NavLink>
      ) : null}
      {canManageStaff(viewer) ? (
        <NavLink href="/staff" icon={<Users />}>
          Staff
        </NavLink>
      ) : null}
      {canManageTills(viewer) ? (
        <NavLink href="/tills" icon={<MonitorSmartphone />}>
          Tills
        </NavLink>
      ) : null}
    </>
  );

  const groups = [
    { items: today, label: "Today" },
    { items: stock, label: "Stock" },
    { items: office, label: "Office" },
  ];

  const initials = viewer.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");

  return (
    <div className="bg-paper lg:grid lg:min-h-svh lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:py-2 lg:pr-2 print:block print:bg-transparent print:p-0">
      <a
        className="bg-brand text-primary-foreground sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        href="#main"
      >
        Skip to content
      </a>

      <aside className="hidden lg:sticky lg:top-2 lg:flex lg:h-[calc(100svh-1rem)] lg:[scrollbar-width:none] lg:flex-col lg:gap-4 lg:overflow-y-auto lg:px-2.5 lg:pt-2.5 print:hidden">
        <div className="flex items-center gap-2.5 px-1.5">
          <TallyMark className="text-brand size-6" />
          <p className="text-md font-semibold tracking-tight">Tally</p>
          <p className="text-ink-3 ms-auto truncate text-xs">{COMPANY_NAME}</p>
        </div>

        <ProductSearch />

        {groups.map((group) => (
          <nav
            aria-label={group.label}
            className="grid gap-px"
            key={group.label}
          >
            <h2 className="text-ink-3 px-2.5 pb-1 text-xs">{group.label}</h2>
            {group.items}
          </nav>
        ))}

        <div className="mt-auto flex items-center gap-2.5 px-1.5 pb-2">
          <span
            aria-hidden="true"
            className="from-brand/90 to-brand/40 text-primary-foreground text-2xs grid size-7 shrink-0 place-items-center rounded-full bg-linear-to-br font-semibold"
          >
            {initials}
          </span>
          <div className="min-w-0 grow leading-tight">
            <p className="truncate text-sm font-medium">{viewer.name}</p>
            <p className="text-ink-3 truncate text-xs">
              {ROLE_LABELS[viewer.role]}
              {homeBranch ? ` · ${homeBranch.name}` : ""}
            </p>
          </div>
          <form action={signOut}>
            <button
              aria-label={`Sign out ${viewer.name}`}
              className="press text-ink-3 hover:text-ink hover:bg-surface grid size-7 place-items-center rounded-md"
              type="submit"
            >
              <LogOut aria-hidden="true" className="size-3.5" />
            </button>
          </form>
        </div>
      </aside>

      <div className="bg-canvas lg:border-line min-w-0 lg:rounded-xl lg:border print:border-0 print:bg-transparent">
        <header className="border-line bg-canvas/85 sticky top-0 z-30 border-b backdrop-blur-md lg:rounded-t-xl print:hidden">
          <div className="flex h-12 items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <TallyMark className="text-brand size-6" />
              <span className="font-semibold">Tally</span>
            </div>
            <ScopeSwitcher
              stores={branches.filter((item) => item.kind === "store")}
              warehouses={branches.filter((item) => item.kind === "warehouse")}
              homeBranchId={viewer.branchId}
              value={scope.kind === "all" ? "all" : scope.branchId}
            />
            <form action={signOut} className="lg:hidden">
              <button
                aria-label={`Sign out ${viewer.name}`}
                className="press text-ink-2 hover:text-ink hover:bg-surface-2 grid size-8 place-items-center rounded-md"
                type="submit"
              >
                <LogOut aria-hidden="true" className="size-4" />
              </button>
            </form>
          </div>
          <nav
            aria-label="Main"
            className="flex [scrollbar-width:none] gap-1 overflow-x-auto px-3 pb-2 lg:hidden"
          >
            {today}
            {stock}
            {office}
          </nav>
        </header>
        <main
          className="canvas-glow px-4 pt-6 pb-16 lg:px-7 lg:pt-7 print:bg-none print:p-0"
          id="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
