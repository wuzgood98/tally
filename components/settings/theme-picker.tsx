"use client";

import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Radio, RadioGroup } from "@/components/ui/choice";
import { useHydrated } from "@/components/ui/use-hydrated";
import { isTheme, THEME_PALETTES } from "@/lib/theme";
import type { Theme } from "@/lib/theme";

type Palette = (typeof THEME_PALETTES)[keyof typeof THEME_PALETTES];

const NAV_WIDTHS = [20, 16, 22, 18, 21, 15];
const STAT_XS = [46, 82, 118];

const ROWS = [
  { name: 38, value: 16, y: 68 },
  { accent: true, name: 30, value: 12, y: 75 },
  { name: 44, value: 18, y: 82 },
];

const Drawing = ({ colors }: { readonly colors: Palette }) => (
  <svg
    aria-hidden="true"
    className="block size-full"
    preserveAspectRatio="xMidYMid slice"
    viewBox="0 0 160 100"
  >
    <rect fill={colors.page} height="100" width="160" />
    <rect fill={colors.accent} height="8" rx="2" width="8" x="7" y="8" />
    <rect fill={colors.ink} height="3" rx="1.5" width="12" x="18" y="10.5" />
    {NAV_WIDTHS.map((width, index) => (
      <rect
        fill={index === 2 ? colors.ink : colors.faint}
        height="2.8"
        key={`${width}-${index}`}
        opacity={index === 2 ? 1 : 0.55}
        rx="1.4"
        width={width}
        x="7"
        y={24 + index * 7}
      />
    ))}
    <circle cx="10" cy="90" fill={colors.accent} opacity="0.8" r="3.2" />
    <rect
      fill={colors.canvas}
      height="92"
      rx="5"
      stroke={colors.line}
      width="118"
      x="38.5"
      y="4.5"
    />
    <path d="M38.5 17.5h118" stroke={colors.line} />
    <rect fill={colors.line} height="5" rx="2.5" width="26" x="45" y="8.5" />
    <rect fill={colors.ink} height="5" rx="2" width="34" x="46" y="24" />
    {STAT_XS.map((x) => (
      <g key={x}>
        <rect
          fill={colors.surface}
          height="20"
          rx="3"
          stroke={colors.line}
          width="32"
          x={x}
          y="35"
        />
        <rect
          fill={colors.faint}
          height="2.2"
          opacity="0.7"
          rx="1.1"
          width="12"
          x={x + 4}
          y="39.5"
        />
        <rect
          fill={colors.ink}
          height="4.6"
          rx="1.5"
          width="18"
          x={x + 4}
          y="45.5"
        />
      </g>
    ))}
    <rect
      fill={colors.surface}
      height="29"
      rx="3"
      stroke={colors.line}
      width="104"
      x="46"
      y="61"
    />
    {ROWS.map((row) => (
      <g key={row.y}>
        <rect
          fill={colors.faint}
          height="2.6"
          opacity="0.7"
          rx="1.3"
          width={row.name}
          x="51"
          y={row.y}
        />
        <rect
          fill={row.accent === true ? colors.accent : colors.faint}
          height="2.6"
          opacity={row.accent === true ? 1 : 0.7}
          rx="1.3"
          width={row.value}
          x={144 - row.value}
          y={row.y}
        />
      </g>
    ))}
  </svg>
);

const LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

/** Light first: it's the default. */
const ORDER: readonly Theme[] = ["light", "dark", "system"];

const DEVICE_DARK = "(prefers-color-scheme: dark)";

const subscribeToDevice = (onChange: () => void) => {
  const query = window.matchMedia(DEVICE_DARK);
  query.addEventListener("change", onChange);

  return () => {
    query.removeEventListener("change", onChange);
  };
};

const deviceIsDark = () => window.matchMedia(DEVICE_DARK).matches;

/** Null on the server, where the device is unknown. */
const noDevice = () => null;

const ThemeCard = ({
  option,
  deviceDark,
}: {
  readonly option: Theme;
  readonly deviceDark: boolean | null;
}) => (
  <label className="group/theme press border-line bg-surface has-data-checked:border-brand has-data-checked:ring-brand has-focus-visible:outline-brand [@media(hover:hover)_and_(pointer:fine)]:hover:not-has-data-checked:border-line-strong relative block cursor-pointer rounded-xl border p-1.25 pb-2 outline-offset-3 has-focus-visible:outline-2 has-data-checked:ring-2">
    <Radio bare value={option} />
    <span className="border-line relative block aspect-160/100 overflow-hidden rounded-md border">
      <Drawing
        colors={option === "dark" ? THEME_PALETTES.dark : THEME_PALETTES.light}
      />
      {option === "system" ? (
        // The dark half, cut on the diagonal.
        <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
          <Drawing colors={THEME_PALETTES.dark} />
        </span>
      ) : null}
    </span>
    <span className="mt-2 flex items-start justify-between gap-1.5 px-1 font-medium">
      <span>
        {LABELS[option]}
        {option === "system" && deviceDark !== null ? (
          <small className="text-ink-3 block text-xs font-normal">
            Your device: {deviceDark ? "Dark" : "Light"}
          </small>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className="border-line-strong group-has-data-checked/theme:border-brand group-has-data-checked/theme:bg-brand group-has-data-checked/theme:text-primary-foreground mt-0.5 grid size-4 shrink-0 scale-90 place-items-center rounded-full border text-transparent transition duration-150 ease-(--ease-out-quick) group-has-data-checked/theme:scale-100"
      >
        <Check className="size-2.75" strokeWidth={3} />
      </span>
    </span>
  </label>
);

/**
 * Light, Dark or System, each drawn as a small Tally. It's the same choice
 * the command palette makes, kept in this browser; it applies at once.
 */
export const ThemePicker = () => {
  const { theme, setTheme } = useTheme();

  const deviceDark = useSyncExternalStore(
    subscribeToDevice,
    deviceIsDark,
    noDevice
  );

  // next-themes only knows the choice in the browser.
  const hydrated = useHydrated();

  const value =
    hydrated && theme !== undefined && isTheme(theme) ? theme : null;

  return (
    <RadioGroup
      aria-label="Theme"
      columns={3}
      onValueChange={(next) => {
        if (next !== null && isTheme(next)) {
          setTheme(next);
        }
      }}
      value={value}
    >
      {ORDER.map((option) => (
        <ThemeCard deviceDark={deviceDark} key={option} option={option} />
      ))}
    </RadioGroup>
  );
};
