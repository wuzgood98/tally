import type { UIMessage } from "ai";
import {
  Boxes,
  Brain,
  ChartColumn,
  Inbox,
  Package,
  PackageMinus,
  PackagePlus,
  PackageSearch,
  Receipt,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Truck,
} from "lucide-react";
import type { ReactNode } from "react";

import { askRunningTool, askStatusLine } from "@/lib/ask/conversation";
import type { AskTools } from "@/lib/ask/tools";

const ICON = "size-3.5 shrink-0";

const THINKING = <Brain aria-hidden="true" className={ICON} />;

/**
 * What each tool is looking at, as the icon its page has in the nav and the
 * palette where there is one. Every tool needs one.
 */
const TOOL_ICONS: ReadonlyMap<string, ReactNode> = new Map(
  Object.entries({
    bestSellers: <Trophy aria-hidden="true" className={ICON} />,
    findProducts: <PackageSearch aria-hidden="true" className={ICON} />,
    lowStock: <TriangleAlert aria-hidden="true" className={ICON} />,
    productStock: <Package aria-hidden="true" className={ICON} />,
    purchaseOrders: <ShoppingCart aria-hidden="true" className={ICON} />,
    recentReceipts: <PackagePlus aria-hidden="true" className={ICON} />,
    sellersReport: <ChartColumn aria-hidden="true" className={ICON} />,
    shrinkageReport: <PackageMinus aria-hidden="true" className={ICON} />,
    stockRequests: <Inbox aria-hidden="true" className={ICON} />,
    stockSummary: <Boxes aria-hidden="true" className={ICON} />,
    stockValueReport: <TrendingUp aria-hidden="true" className={ICON} />,
    todaysSales: <Receipt aria-hidden="true" className={ICON} />,
    transfers: <Truck aria-hidden="true" className={ICON} />,
  } satisfies Record<keyof AskTools, ReactNode>)
);

/**
 * Ask Tally's line while an answer is on its way: an icon for what it's
 * doing (a brain while it thinks, the page's icon while a tool runs) and the
 * words, with one shimmer sweeping across both.
 */
export const AskStatus = ({
  message,
}: {
  readonly message: UIMessage | undefined;
}) => {
  const tool = askRunningTool(message);

  return (
    <p className="text-ink-3 text-sm">
      <span className="shimmer inline-flex items-center gap-2">
        {(tool === null ? undefined : TOOL_ICONS.get(tool)) ?? THINKING}
        {askStatusLine(message)}
      </span>
    </p>
  );
};
