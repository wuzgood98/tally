"use client";

import { useState, useTransition } from "react";
import type { PointerEvent } from "react";

import { setScope } from "@/app/(app)/scope-action";
import {
  Frame,
  FrameFooter,
  FrameHeader,
  FramePanelButton,
  FrameTitle,
} from "@/components/ui/frame";
import { SHELF_STATUS } from "@/components/ui/shelf-status";
import { BOARD_COLUMNS } from "@/lib/branch-board";
import type { BoardBin, BoardProblem, ProblemStatus } from "@/lib/branch-board";
import { formatCount } from "@/lib/format";
import { formatCedisCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

interface BranchBoardProps {
  readonly bins: readonly BoardBin[];
  /** Shared by every bin, so they line up. */
  readonly rows: number;
  /** Placement only, such as margins: it lands on the frame. */
  readonly className?: string;
}

/** Healthiest first, as the squares settle in a bin. */
const LEGEND: readonly (ProblemStatus | "ok")[] = [
  "ok",
  "covered",
  "low",
  "out",
  "count",
];

const legendLabel = (status: ProblemStatus | "ok"): string =>
  status === "ok" ? "Above reorder point" : SHELF_STATUS[status].label;

const spokenName = (bin: BoardBin): string => {
  const parts = [
    `${formatCount(bin.lines)} lines`,
    `${formatCount(bin.low)} low`,
    `${formatCount(bin.out)} out`,
  ];

  if (bin.covered > 0) {
    parts.push(`${formatCount(bin.covered)} covered`);
  }

  return `${bin.name}: ${parts.join(", ")}, ${formatCedisCompact(bin.costValue)} at cost. Show this branch.`;
};

/** The product under the mouse, in the bin's footer. */
const Readout = ({ problem }: { readonly problem: BoardProblem }) => (
  <>
    <span className="text-ink block truncate text-xs font-medium">
      {problem.name}
    </span>
    <span className="figures text-ink-3 text-2xs block">
      {formatCount(problem.onHand)} / {formatCount(problem.reorderPoint)} ·{" "}
      {SHELF_STATUS[problem.status].label.toLowerCase()}
    </span>
  </>
);

const Summary = ({ bin }: { readonly bin: BoardBin }) => (
  <>
    <span className="figures text-ink block text-sm font-semibold">
      {formatCedisCompact(bin.costValue)}
    </span>
    <span className="figures text-2xs flex gap-2 whitespace-nowrap">
      <span className={bin.low > 0 ? "text-warn" : "text-ink-3"}>
        {formatCount(bin.low)} low
      </span>
      <span className={bin.out > 0 ? "text-danger" : "text-ink-3"}>
        {formatCount(bin.out)} out
      </span>
      {/* With these, low + out + covered matches "Need reordering". */}
      {bin.covered > 0 ? (
        <span className="text-brand">{formatCount(bin.covered)} covered</span>
      ) : null}
    </span>
  </>
);

interface BinProps {
  readonly bin: BoardBin;
  readonly rows: number;
  readonly pending: boolean;
  readonly onChoose: (id: string) => void;
}

const Bin = ({ bin, rows, pending, onChoose }: BinProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const healthy = Math.max(bin.lines - bin.problems.length, 0);
  const spacers = Math.max(rows * BOARD_COLUMNS - bin.lines, 0);
  const problem = hovered === null ? undefined : bin.problems[hovered];

  // Mouse only: a tap on a phone is a press on the bin, not a hover.
  const handlePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== "mouse") {
      return;
    }

    const index =
      event.target instanceof HTMLElement
        ? event.target.dataset.index
        : undefined;

    setHovered(index === undefined ? null : Number(index));
  };

  return (
    <FramePanelButton
      aria-label={spokenName(bin)}
      onClick={() => {
        onChoose(bin.id);
      }}
      pending={pending}
    >
      <span className="flex min-w-0 flex-col gap-2.5">
        <span className="block min-w-0">
          <span className="text-ink block truncate text-sm font-semibold">
            {bin.name}
          </span>
          <span className="text-ink-3 text-2xs block truncate">
            {bin.kind === "warehouse" ? "Warehouse" : "Store"} ·{" "}
            {formatCount(bin.lines)} lines
          </span>
        </span>

        <span
          aria-hidden="true"
          className="grid grid-cols-12 gap-0.5"
          onPointerLeave={() => {
            setHovered(null);
          }}
          onPointerMove={handlePointerMove}
        >
          {Array.from({ length: spacers }, (_, index) => (
            <span className="aspect-square" key={`spacer-${index}`} />
          ))}
          {Array.from({ length: healthy }, (_, index) => (
            <span
              className={cn("aspect-square rounded-xs", SHELF_STATUS.ok.square)}
              key={`ok-${index}`}
            />
          ))}
          {bin.problems.map((item, index) => (
            <span
              className={cn(
                "aspect-square rounded-xs",
                SHELF_STATUS[item.status].square,
                index === hovered && "outline-ink outline-2 outline-offset-1"
              )}
              data-index={index}
              key={item.productId}
            />
          ))}
        </span>

        {/* Fixed height, so the readout never shifts the bin. */}
        <span aria-hidden="true" className="block h-9 min-w-0">
          {problem === undefined ? (
            <Summary bin={bin} />
          ) : (
            <Readout problem={problem} />
          )}
        </span>
      </span>
    </FramePanelButton>
  );
};

/**
 * Every branch's shelves at once: one square per product line, the worst
 * settled at the bottom. Hover a square for the product; press a bin to
 * switch the whole app to that branch. Drawn without motion: it's the first
 * thing head office sees, many times a day.
 */
export const BranchBoard = ({ bins, rows, className }: BranchBoardProps) => {
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<string | null>(null);

  const choose = (id: string) => {
    setChoice(id);
    const formData = new FormData();
    formData.set("scope", id);
    startTransition(async () => {
      await setScope(formData);
    });
  };

  return (
    <Frame aria-labelledby="branches-title" as="section" className={className}>
      <FrameHeader>
        <FrameTitle id="branches-title">Branches</FrameTitle>
      </FrameHeader>
      {/* The bins are the frame's panels, side by side on its tray. */}
      <div className="grid grid-cols-2 gap-1 md:grid-cols-3 xl:grid-cols-6">
        {bins.map((bin) => (
          <Bin
            bin={bin}
            key={bin.id}
            onChoose={choose}
            pending={pending && choice === bin.id}
            rows={rows}
          />
        ))}
      </div>
      <FrameFooter>
        <ul className="text-ink-2 text-2xs flex flex-wrap gap-x-4 gap-y-1">
          {LEGEND.map((status) => (
            <li className="flex items-center gap-1.5" key={status}>
              <span
                aria-hidden="true"
                className={cn("size-2 rounded-xs", SHELF_STATUS[status].square)}
              />
              {legendLabel(status)}
            </li>
          ))}
        </ul>
      </FrameFooter>
    </Frame>
  );
};
