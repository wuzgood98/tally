"use client";

import { useState } from "react";
import type { PointerEvent } from "react";

import { formatCedis, formatCedisCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface ChartPoint {
  /** "13 Nov" */
  readonly label: string;
  /** Pesewas. */
  readonly value: number;
}

interface TimeChartProps {
  /** What the chart shows, for screen readers: "Stock value, last 30 days". */
  readonly title: string;
  readonly points: readonly ChartPoint[];
  /** A line for a level over time; columns for amounts per day. */
  readonly mark: "line" | "columns";
  /** Plot height in pixels. */
  readonly height?: number;
}

const TICKS = 4;
const STEPS = [1, 2, 2.5, 5, 10] as const;

/** A round step that splits `span` into about `TICKS` parts. */
const niceStep = (span: number): number => {
  const raw = span / TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = STEPS.find((candidate) => candidate * magnitude >= raw) ?? 10;

  return step * magnitude;
};

/**
 * The y range and its ticks. Columns grow from zero; a line hugs its data
 * (a month's stock value moves a few percent, which a zero baseline flattens).
 */
const yScale = (values: readonly number[], fromZero: boolean) => {
  const high = Math.max(...values, 0);
  const low = fromZero ? 0 : Math.min(...values);
  const span = high - low || Math.abs(high) || 100;
  const step = niceStep(span);
  const min = fromZero ? 0 : Math.floor(low / step) * step;
  const max = Math.max(Math.ceil(high / step) * step, min + step);
  const ticks: number[] = [];

  for (let tick = min; tick <= max; tick += step) {
    ticks.push(tick);
  }

  return { max, min, ticks };
};

/** Percent from the left edge for point `index`. */
const xAt = (index: number, count: number, columns: boolean): number => {
  if (columns) {
    return ((index + 0.5) / count) * 100;
  }

  return count === 1 ? 50 : (index / (count - 1)) * 100;
};

/** Keeps the readout inside the plot near either edge. */
const tooltipAlign = (x: number): string => {
  if (x < 15) {
    return "translate-x-0";
  }

  return x > 85 ? "-translate-x-full" : "-translate-x-1/2";
};

const percent = (value: number): string => `${value}%`;

const LinePaths = ({
  points,
  yOf,
}: {
  readonly points: readonly ChartPoint[];
  readonly yOf: (value: number) => number;
}) => {
  const coords = points.map(
    (point, index) => `${xAt(index, points.length, false)},${yOf(point.value)}`
  );

  const line = `M${coords.join(" L")}`;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <path className="fill-brand opacity-10" d={`${line} L100,100 L0,100 Z`} />
      <path
        className="stroke-brand fill-none"
        d={line}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

const Columns = ({
  points,
  yOf,
  active,
}: {
  readonly points: readonly ChartPoint[];
  readonly yOf: (value: number) => number;
  readonly active: number | null;
}) => (
  <div aria-hidden="true" className="absolute inset-0 flex">
    {points.map((point, index) => (
      <div
        className="flex flex-1 items-end justify-center px-px"
        key={point.label}
      >
        {point.value > 0 ? (
          <div
            className={cn(
              "bg-brand h-(--bar) w-full max-w-6 rounded-t-sm transition-opacity",
              active !== null && active !== index ? "opacity-50" : undefined
            )}
            style={{ "--bar": percent(100 - yOf(point.value)) }}
          />
        ) : null}
      </div>
    ))}
  </div>
);

/** The crosshair, the point on the line, and the value above it. */
const Readout = ({
  point,
  x,
  y,
  columns,
}: {
  readonly point: ChartPoint;
  readonly x: number;
  readonly y: number;
  readonly columns: boolean;
}) => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0"
    style={{ "--x": percent(x), "--y": percent(y) }}
  >
    {columns ? null : (
      <>
        <div className="bg-ink-3 absolute inset-y-0 left-(--x) w-px" />
        <div className="bg-brand ring-surface absolute top-(--y) left-(--x) size-2.5 -translate-1/2 rounded-full ring-2" />
      </>
    )}
    <div
      className={cn(
        "border-line bg-surface absolute -top-2 left-(--x) z-10 -translate-y-full rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm",
        tooltipAlign(x)
      )}
    >
      <p className="tabular font-semibold">{formatCedis(point.value)}</p>
      <p className="text-ink-2">{point.label}</p>
    </div>
  </div>
);

/**
 * A single-series chart over days, drawn in SVG and HTML with no chart
 * library. An invisible range input covers the plot: hovering moves it, and
 * when focused the arrow keys, Home and End step through the days, each read
 * out as "13 Nov: GH₵…". The table beside the chart carries every value too.
 */
export const TimeChart = ({
  title,
  points,
  mark,
  height = 180,
}: TimeChartProps) => {
  const [active, setActive] = useState<number | null>(null);
  const columns = mark === "columns";
  const lastIndex = points.length - 1;

  const { min, max, ticks } = yScale(
    points.map((point) => point.value),
    columns
  );

  const yOf = (value: number): number =>
    100 - ((value - min) / (max - min)) * 100;

  if (points.length === 0) {
    return null;
  }

  const pick = (event: PointerEvent<HTMLInputElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;

    const index = columns
      ? Math.floor(ratio * points.length)
      : Math.round(ratio * lastIndex);

    setActive(Math.min(Math.max(index, 0), lastIndex));
  };

  const point = active === null ? undefined : points[active];
  const shown = point ?? points[lastIndex];
  const [first] = points;
  const middle = points[Math.floor(lastIndex / 2)];
  const last = points[lastIndex];

  return (
    <figure
      className="grid grid-cols-[auto_1fr] gap-x-2"
      style={{ "--plot": `${height}px` }}
    >
      <div
        aria-hidden="true"
        className="text-ink-3 tabular relative h-(--plot) w-14 text-right text-xs"
      >
        {ticks.map((tick) => (
          <span
            className="absolute top-(--y) right-0 -translate-y-1/2"
            key={tick}
            style={{ "--y": percent(yOf(tick)) }}
          >
            {formatCedisCompact(tick)}
          </span>
        ))}
      </div>

      <div className="has-focus-visible:ring-brand/40 relative h-(--plot) rounded-sm has-focus-visible:ring-2">
        {ticks.map((tick) => (
          <div
            aria-hidden="true"
            className="bg-line absolute inset-x-0 top-(--y) h-px"
            key={tick}
            style={{ "--y": percent(yOf(tick)) }}
          />
        ))}

        {columns ? (
          <Columns active={active} points={points} yOf={yOf} />
        ) : (
          <LinePaths points={points} yOf={yOf} />
        )}

        {point === undefined || active === null ? null : (
          <Readout
            columns={columns}
            point={point}
            x={xAt(active, points.length, columns)}
            y={yOf(point.value)}
          />
        )}

        <input
          aria-label={title}
          aria-valuetext={
            shown === undefined
              ? undefined
              : `${shown.label}: ${formatCedis(shown.value)}`
          }
          className="absolute inset-0 z-20 size-full cursor-crosshair appearance-none opacity-0"
          max={lastIndex}
          min={0}
          onBlur={() => {
            setActive(null);
          }}
          onChange={(event) => {
            setActive(Number(event.target.value));
          }}
          onFocus={() => {
            setActive((current) => current ?? lastIndex);
          }}
          onPointerLeave={(event) => {
            if (document.activeElement !== event.currentTarget) {
              setActive(null);
            }
          }}
          onPointerMove={pick}
          step={1}
          type="range"
          value={active ?? lastIndex}
        />
      </div>

      <div />
      <div
        aria-hidden="true"
        className="text-ink-3 mt-1.5 flex justify-between text-xs"
      >
        <span>{first?.label}</span>
        {points.length > 2 ? <span>{middle?.label}</span> : null}
        {points.length > 1 ? <span>{last?.label}</span> : null}
      </div>
    </figure>
  );
};
