import { ArrowRight, KeyRound } from "lucide-react";

import { Frame, FramePanelLink } from "@/components/ui/frame";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OfficeLinksProps {
  readonly staff: { readonly active: number; readonly deactivated: number };
  readonly tills: { readonly active: number; readonly revoked: number };
}

const plural = (count: number, one: string, many: string): string =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

/** One mark per thing, the live ones first, each with a stable key. */
const marks = (live: number, gone: number, kind: string) =>
  Array.from({ length: live + gone }, (_, index) => ({
    active: index < live,
    key: `${kind}-${index}`,
  }));

/** Most people in a row before the dots stop and a count takes over. */
const DOTS_SHOWN = 40;

const CardHead = ({ title }: { readonly title: string }) => (
  <span className="flex items-center justify-between gap-2 font-medium">
    {title}
    <ArrowRight
      aria-hidden="true"
      className="text-ink-3 group-hover/card:text-brand size-4 transition-transform duration-150 ease-(--ease-out-quick) group-hover/card:translate-x-0.5 rtl:-scale-x-100"
    />
  </span>
);

/**
 * Staff and Tills stay their own pages; these cards show where things stand
 * and take you there. A dot per person (deactivated ones dashed), a key per
 * till (revoked ones struck through).
 */
export const OfficeLinks = ({ staff, tills }: OfficeLinksProps) => {
  const people = marks(staff.active, staff.deactivated, "person").slice(
    0,
    DOTS_SHOWN
  );

  const keys = marks(tills.active, tills.revoked, "till");

  return (
    <Frame>
      <div className="grid gap-1 sm:grid-cols-2">
        <FramePanelLink className="group/card" href="/staff">
          <CardHead title="Staff" />
          <span className="figures text-ink-2 mt-0.5 mb-3.5 block text-xs">
            {plural(staff.active, "person", "people")}
            {staff.deactivated > 0 ? (
              <span className="text-ink-3">
                {" "}
                · {formatCount(staff.deactivated)} deactivated
              </span>
            ) : null}
          </span>
          <span aria-hidden="true" className="flex flex-wrap gap-1">
            {people.map(({ active, key }) => (
              <i
                className={cn(
                  "size-1.75 rounded-xs",
                  active ? "bg-brand/70" : "border-ink-3 border border-dashed"
                )}
                key={key}
              />
            ))}
          </span>
        </FramePanelLink>
        <FramePanelLink className="group/card" href="/tills">
          <CardHead title="Tills" />
          <span className="figures text-ink-2 mt-0.5 mb-3.5 block text-xs">
            {plural(tills.active, "till", "tills")}
            {tills.revoked > 0 ? (
              <span className="text-ink-3">
                {" "}
                · {plural(tills.revoked, "key", "keys")} revoked
              </span>
            ) : null}
          </span>
          <span aria-hidden="true" className="flex flex-wrap gap-1.5">
            {keys.length === 0 ? (
              <span className="text-ink-3 text-xs">
                No tills yet. Add one to let a POS post sales.
              </span>
            ) : null}
            {keys.map(({ active, key }) => (
              <i
                className={cn(
                  "relative grid size-7.5 place-items-center rounded-md border",
                  active
                    ? "border-line bg-surface-2 text-ink-2"
                    : "bg-danger-soft text-danger border-transparent"
                )}
                key={key}
              >
                <KeyRound className="size-3.5" />
                {active ? null : (
                  <span className="bg-danger absolute inset-x-1 top-1/2 h-px -rotate-45" />
                )}
              </i>
            ))}
          </span>
        </FramePanelLink>
      </div>
    </Frame>
  );
};
