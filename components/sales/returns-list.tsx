import { Panel } from "@/components/ui/panel";
import { formatCount, formatDateTime, isoString } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import type { SaleReturnSummary } from "@/lib/queries/sales";

/** Returns already made against a sale: who approved them, why, and what came back. */
export const ReturnsList = ({
  returns,
}: {
  readonly returns: readonly SaleReturnSummary[];
}) => (
  <Panel id="returns" title={`Returns · ${formatCount(returns.length)}`}>
    <ul className="divide-line grid divide-y">
      {returns.map((item) => (
        <li
          className="grid gap-1 py-3 text-sm first:pt-0 last:pb-0"
          key={item.id}
        >
          <p className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-xs font-medium">{item.number}</span>
            <span className="tabular font-medium">
              Refund {formatCedis(item.refund)}
            </span>
          </p>
          <p className="text-ink-2 text-xs">
            <time dateTime={isoString(item.createdAt)}>
              {formatDateTime(item.createdAt)}
            </time>{" "}
            · approved by {item.approvedBy ?? "—"} · {item.reason}
          </p>
          <ul className="text-ink-2 text-xs">
            {item.lines.map((line) => (
              <li key={line.productId}>
                {formatCount(line.quantity)} × {line.name}
                {line.disposition === "damaged" ? (
                  <span className="text-danger"> · written off as damaged</span>
                ) : (
                  " · back on the shelf"
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  </Panel>
);
