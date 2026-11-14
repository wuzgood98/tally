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
import { cookies } from "next/headers";

import { signOut } from "@/app/login/actions";
import { TallyMark } from "@/components/brand/tally-mark";
import {
  PaletteFieldTrigger,
  PaletteIconTrigger,
} from "@/components/shell/command-palette";
import { CommandPaletteProvider } from "@/components/shell/command-palette-provider";
import { FlashToast } from "@/components/shell/flash-toast";
import { NavLink } from "@/components/shell/nav-link";
import { ScopeSwitcher } from "@/components/shell/scope-switcher";
import {
  Sidebar,
  SidebarFrame,
  SidebarProvider,
  SidebarToggle,
} from "@/components/shell/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { FLASH_COOKIE, parseFlash } from "@/lib/flash";
import { paletteCommands } from "@/lib/palette";
import {
  canApprovePurchaseOrder,
  canBrowseBackOffice,
  canDispatchTransfer,
  canManageStaff,
  canManageTills,
  canViewReports,
  sellableBranchIds,
  visibleBranchIds,
} from "@/lib/permissions";
import { getOverviewTotals } from "@/lib/queries/overview";
import { countDraftPurchaseOrders } from "@/lib/queries/purchase-orders";
import { countOpenRequests } from "@/lib/queries/requests";
import { countIncomingInTransit } from "@/lib/queries/transfers";
import { getScope, listBranches } from "@/lib/scope";
import { requireViewer } from "@/lib/session";
import { isSidebarCollapsed, SIDEBAR_COOKIE } from "@/lib/sidebar";
import { COMPANY_NAME, ROLE_LABELS } from "@/lib/site";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

const AppLayout = async ({ children }: LayoutProps<"/">) => {
  const viewer = await requireViewer();

  const [branches, scope, jar] = await Promise.all([
    listBranches(),
    getScope(viewer),
    cookies(),
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
  const backOffice = canBrowseBackOffice(viewer);

  // Only someone who sees every branch gets the switcher; a cashier sees
  // their store's name instead.
  const switchesBranch =
    visibleBranchIds(
      viewer,
      branches.map((item) => item.id)
    ).length === branches.length;

  const sellsSomewhere =
    sellableBranchIds(
      viewer,
      branches.flatMap((item) => (item.kind === "store" ? [item.id] : []))
    ).length > 0;

  const today = (
    <>
      {backOffice ? (
        <NavLink href="/" icon={<LayoutDashboard />}>
          Overview
        </NavLink>
      ) : null}
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

  const stockBackOffice = (
    <>
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

  const stock = (
    <>
      <NavLink href="/products" icon={<Package />}>
        Products
      </NavLink>
      {backOffice ? stockBackOffice : null}
    </>
  );

  const office = (
    <>
      {backOffice ? (
        <NavLink
          badge={draftsToApprove}
          href="/purchase-orders"
          icon={<ShoppingCart />}
          urgent
        >
          Purchase orders
        </NavLink>
      ) : null}
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
    // Reports, Staff and Tills are back office too, so a cashier has none.
    ...(backOffice ? [{ items: office, label: "Office" }] : []),
  ];

  const initials = viewer.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");

  return (
    <SidebarProvider
      defaultCollapsed={isSidebarCollapsed(jar.get(SIDEBAR_COOKIE))}
    >
      <CommandPaletteProvider
        // No branch switching from the palette for someone fixed to theirs.
        branches={
          switchesBranch
            ? branches.map(({ id, kind, name }) => ({ id, kind, name }))
            : []
        }
        groups={paletteCommands(viewer, branches)}
        scope={scope.kind === "all" ? "all" : scope.branchId}
        theme={parseTheme(jar.get(THEME_COOKIE)?.value)}
      >
        <SidebarFrame className="bg-paper lg:grid lg:min-h-svh lg:py-2 lg:pr-2 print:block print:bg-transparent print:p-0">
          <a
            className="bg-brand text-primary-foreground sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
            href="#main"
          >
            Skip to content
          </a>

          <Sidebar className="hidden lg:sticky lg:top-2 lg:flex lg:h-[calc(100svh-1rem)] lg:[scrollbar-width:none] lg:flex-col lg:gap-4 lg:overflow-y-auto lg:px-2.5 lg:pt-2.5 print:hidden">
            <div className="rail:justify-center rail:px-0 flex items-center gap-2.5 px-1.5">
              <TallyMark className="text-brand size-6 shrink-0" />
              <p className="text-md rail:sr-only font-semibold tracking-tight">
                Tally
              </p>
              <p className="text-ink-3 rail:hidden ms-auto truncate text-xs">
                {COMPANY_NAME}
              </p>
            </div>

            <div className="rail:hidden">
              <PaletteFieldTrigger />
            </div>
            <div className="rail:grid hidden place-items-center">
              <PaletteIconTrigger />
            </div>

            {groups.map((group) => (
              <nav
                aria-label={group.label}
                className="grid gap-px"
                key={group.label}
              >
                <h2 className="text-ink-3 rail:sr-only px-2.5 pb-1 text-xs">
                  {group.label}
                </h2>
                {group.items}
              </nav>
            ))}

            <div className="rail:flex-col-reverse rail:px-0 mt-auto flex items-center gap-2.5 px-1.5 pb-2">
              <span
                aria-hidden="true"
                className="from-brand/90 to-brand/40 text-primary-foreground text-2xs grid size-7 shrink-0 place-items-center rounded-full bg-linear-to-br font-semibold"
              >
                {initials}
              </span>
              <div className="rail:sr-only min-w-0 grow leading-tight">
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
          </Sidebar>

          <div className="bg-canvas lg:border-line min-w-0 lg:rounded-xl lg:border lg:[view-transition-name:canvas] print:border-0 print:bg-transparent">
            <header className="border-line bg-canvas/85 sticky top-0 z-30 border-b backdrop-blur-md lg:rounded-t-xl print:hidden">
              <div className="flex h-12 items-center justify-between gap-3 px-4 lg:justify-start lg:px-6">
                <div className="flex items-center gap-2 lg:hidden">
                  <TallyMark className="text-brand size-6" />
                  <span className="font-semibold">Tally</span>
                </div>
                <SidebarToggle />
                {switchesBranch ? (
                  <ScopeSwitcher
                    // The palette can change the scope too; remount to show it.
                    key={scope.kind === "all" ? "all" : scope.branchId}
                    stores={branches.filter((item) => item.kind === "store")}
                    warehouses={branches.filter(
                      (item) => item.kind === "warehouse"
                    )}
                    homeBranchId={viewer.branchId}
                    value={scope.kind === "all" ? "all" : scope.branchId}
                  />
                ) : (
                  <p className="text-ink-2 flex min-w-0 items-center gap-2 text-sm">
                    <span
                      aria-hidden="true"
                      className="bg-brand ring-brand-soft size-1.5 shrink-0 rounded-full ring-3"
                    />
                    <span className="truncate">
                      {homeBranch?.name ?? "Your store"}
                    </span>
                  </p>
                )}
                <div className="flex shrink-0 items-center gap-1 lg:hidden">
                  <PaletteIconTrigger />
                  <form action={signOut}>
                    <button
                      aria-label={`Sign out ${viewer.name}`}
                      className="press text-ink-2 hover:text-ink hover:bg-surface-2 grid size-8 place-items-center rounded-md"
                      type="submit"
                    >
                      <LogOut aria-hidden="true" className="size-4" />
                    </button>
                  </form>
                </div>
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
        </SidebarFrame>
        <Toaster />
        <FlashToast flash={parseFlash(jar.get(FLASH_COOKIE)?.value)} />
      </CommandPaletteProvider>
    </SidebarProvider>
  );
};

export default AppLayout;
