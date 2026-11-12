import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  PackagePlus,
  Receipt,
  ScanBarcode,
  ScrollText,
  TriangleAlert,
  Truck,
  Users,
} from "lucide-react";

import { signOut } from "@/app/login/actions";
import { TallyMark } from "@/components/brand/tally-mark";
import { NavLink } from "@/components/shell/nav-link";
import { ScopeSwitcher } from "@/components/shell/scope-switcher";
import { canManageStaff, sellableBranchIds } from "@/lib/permissions";
import { getOverviewTotals } from "@/lib/queries/overview";
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

  const [totals, incoming] = await Promise.all([
    getOverviewTotals(scope),
    countIncomingInTransit(scope),
  ]);

  const homeBranch = branches.find((item) => item.id === viewer.branchId);

  const sellsSomewhere =
    sellableBranchIds(
      viewer,
      branches.flatMap((item) => (item.kind === "store" ? [item.id] : []))
    ).length > 0;

  const nav = (
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
      <NavLink href="/products" icon={<Package />}>
        Products
      </NavLink>
      <NavLink
        badge={totals.lowLines + totals.outLines}
        href="/low-stock"
        icon={<TriangleAlert />}
      >
        Low stock
      </NavLink>
      <NavLink href="/receipts" icon={<PackagePlus />}>
        Receive goods
      </NavLink>
      <NavLink badge={incoming} href="/transfers" icon={<Truck />}>
        Transfers
      </NavLink>
      <NavLink href="/adjustments" icon={<ClipboardList />}>
        Adjustments
      </NavLink>
      <NavLink href="/movements" icon={<ScrollText />}>
        Movements
      </NavLink>
      {canManageStaff(viewer) ? (
        <NavLink href="/staff" icon={<Users />}>
          Staff
        </NavLink>
      ) : null}
    </>
  );

  return (
    <div className="lg:grid lg:min-h-svh lg:grid-cols-[15rem_1fr]">
      <a
        className="bg-brand text-primary-foreground sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        href="#main"
      >
        Skip to content
      </a>

      <aside className="border-line bg-paper hidden border-r lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-6">
          <TallyMark className="text-brand size-7" />
          <div className="leading-tight">
            <p className="font-semibold">Tally</p>
            <p className="text-ink-2 text-xs">{COMPANY_NAME}</p>
          </div>
        </div>
        <nav aria-label="Main" className="grid gap-0.5 px-2">
          {nav}
        </nav>
        <div className="border-line mt-auto border-t p-3">
          <p className="truncate text-sm font-medium">{viewer.name}</p>
          <p className="text-ink-2 truncate text-xs">
            {ROLE_LABELS[viewer.role]}
            {homeBranch ? ` · ${homeBranch.name}` : ""}
          </p>
          <form action={signOut} className="mt-2">
            <button
              className="press text-ink-2 hover:text-ink -ml-1 flex items-center gap-1.5 rounded px-1 py-0.5 text-xs"
              type="submit"
            >
              <LogOut aria-hidden="true" className="size-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-line bg-paper/90 sticky top-0 z-30 border-b backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-8">
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
            {nav}
          </nav>
        </header>
        <main className="px-4 pt-6 pb-16 lg:px-8 lg:pt-8" id="main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
