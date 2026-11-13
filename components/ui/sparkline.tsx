import { cn } from "@/lib/utils";

const WIDTH = 120;
const HEIGHT = 28;
const INSET = 2;
const BAR_GAP = 1.5;

/** Older bars fade back so today reads first. */
const OLDEST_BAR_OPACITY = 0.35;

const TONES = {
  brand: "stroke-brand fill-brand/10",
  warn: "stroke-warn fill-warn/10",
} as const;

const BAR_TONES = { brand: "fill-brand", warn: "fill-warn" } as const;

type Tone = keyof typeof TONES;

const svgClass = "block h-7 w-full overflow-visible";

/** A level over time, such as stock value: a line with a faint area under it. */
const Line = ({
  values,
  tone,
  className,
}: {
  readonly values: readonly number[];
  readonly tone: Tone;
  readonly className?: string;
}) => {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = WIDTH / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y = HEIGHT - INSET - ((value - min) / range) * (HEIGHT - INSET * 2);

    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  const line = `M${points.join("L")}`;

  return (
    <svg
      aria-hidden="true"
      className={cn(svgClass, TONES[tone], className)}
      preserveAspectRatio="none"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <path d={`${line}L${WIDTH} ${HEIGHT}L0 ${HEIGHT}Z`} stroke="none" />
      <path
        d={line}
        fill="none"
        strokeLinejoin="round"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

/** Things counted per day, such as sales or deliveries: one bar a day from zero. */
const Bars = ({
  values,
  tone,
  className,
}: {
  readonly values: readonly number[];
  readonly tone: Tone;
  readonly className?: string;
}) => {
  const max = Math.max(...values) || 1;
  const slot = WIDTH / values.length;
  const fade = (1 - OLDEST_BAR_OPACITY) / Math.max(values.length - 1, 1);

  return (
    <svg
      aria-hidden="true"
      className={cn(svgClass, BAR_TONES[tone], className)}
      preserveAspectRatio="none"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      {values.map((value, index) => {
        // A day with nothing still shows a sliver, so the gap reads as zero.
        const height = Math.max((value / max) * HEIGHT, 1);

        return (
          <rect
            height={height}
            // The days never reorder, so the position is the identity.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            opacity={OLDEST_BAR_OPACITY + index * fade}
            rx="1"
            width={slot - BAR_GAP}
            x={index * slot + BAR_GAP / 2}
            y={HEIGHT - height}
          />
        );
      })}
    </svg>
  );
};

/** The shape of a series, not its values: those are in the text beside it. */
export const Sparkline = ({
  values,
  tone = "brand",
  variant = "line",
  className,
}: {
  readonly values: readonly number[];
  readonly tone?: Tone;
  readonly variant?: "line" | "bars";
  readonly className?: string;
}) => {
  if (values.length < 2) {
    return null;
  }

  return variant === "bars" ? (
    <Bars className={className} tone={tone} values={values} />
  ) : (
    <Line className={className} tone={tone} values={values} />
  );
};
