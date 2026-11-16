/** Ghana keeps GMT all year, so one fixed zone covers every branch. */
const TIME_ZONE = "Africa/Accra";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: TIME_ZONE,
});

const dateOnly = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
  year: "numeric",
});

const longDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
  weekday: "long",
});

const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});

const timeOnly = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const count = new Intl.NumberFormat("en-GH");

/** "14:05" */
export const formatTime = (date: Date): string => timeOnly.format(date);

/** "12 Nov, 14:05" */
export const formatDateTime = (date: Date): string => dateTime.format(date);

/** "12 Nov 2026" */
export const formatDate = (date: Date): string => dateOnly.format(date);

/** "Thursday 12 November" */
export const formatLongDate = (date: Date): string => longDate.format(date);

/** "2026-11-13" (a report day) → "13 Nov". Accra's day is the UTC day. */
export const formatDay = (day: string): string =>
  dayMonth.format(new Date(`${day}T00:00:00Z`));

/** 12345 → "12,345" */
export const formatCount = (value: number): string => count.format(value);

/** "1 unit", "1,200 units". */
export const formatUnits = (value: number): string =>
  `${count.format(value)} ${value === 1 ? "unit" : "units"}`;

/** "1 sale", "1,200 sales". */
export const formatSales = (value: number): string =>
  `${count.format(value)} ${value === 1 ? "sale" : "sales"}`;

/** +12 / −3, with a true minus sign. */
export const formatSigned = (value: number): string =>
  value > 0 ? `+${count.format(value)}` : `−${count.format(Math.abs(value))}`;

/** ISO timestamp for <time dateTime>. */
export const isoString = (date: Date): string => date.toISOString();
