import { APP_TIMEZONE } from "./constants";

/**
 * Returns the current date in Asia/Kolkata as a 'YYYY-MM-DD' string.
 */
export function getTodayISTString(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Parses a 'YYYY-MM-DD' string into year, month (1-12), day.
 */
export function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }
  return { year: parts[0], month: parts[1], day: parts[2] };
}

/**
 * Formats year, month (1-12), day into 'YYYY-MM-DD'.
 */
export function formatDateString(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Checks whether a year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns number of days in a given month (month is 1-12).
 */
export function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1: // Jan
    case 3: // Mar
    case 5: // May
    case 7: // Jul
    case 8: // Aug
    case 10: // Oct
    case 12: // Dec
      return 31;
    case 4: // Apr
    case 6: // Jun
    case 9: // Sep
    case 11: // Nov
      return 30;
    case 2: // Feb
      return isLeapYear(year) ? 29 : 28;
    default:
      throw new Error(`Invalid month: ${month}`);
  }
}

/**
 * Adds exact number of days to a 'YYYY-MM-DD' date string.
 */
export function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDateString(dateStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

/**
 * Calculates number of calendar days between dateA and dateB (dateB - dateA).
 * Both in 'YYYY-MM-DD' format.
 */
export function differenceInCalendarDays(dateB: string, dateA: string): number {
  const pA = parseDateString(dateA);
  const pB = parseDateString(dateB);
  const utcA = Date.UTC(pA.year, pA.month - 1, pA.day);
  const utcB = Date.UTC(pB.year, pB.month - 1, pB.day);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utcB - utcA) / msPerDay);
}

/**
 * Adds calendar months to a 'YYYY-MM-DD' date using clamp-to-last-valid-day rule.
 * Example:
 * 31 Jan + 1 month -> clamp to 28 Feb (or 29 Feb in leap year).
 * 31 Mar + 1 month -> clamp to 30 Apr.
 */
export function addMonthsClamped(dateStr: string, monthsToAdd: number): string {
  const { year, month, day } = parseDateString(dateStr);
  let totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;

  const maxDays = getDaysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(day, maxDays);

  return formatDateString(targetYear, targetMonth, targetDay);
}

/**
 * Computes membership term interval:
 * Interval is half-open: [start_date, end_date)
 * Display valid-through is end_date - 1 day.
 */
export function calculateTermDates(
  startDateStr: string,
  durationUnit: "DAYS" | "MONTHS",
  durationQuantity: number
): {
  startDate: string; // inclusive
  endDate: string; // exclusive
  validThrough: string; // inclusive display date
} {
  let endDate: string;
  if (durationUnit === "DAYS") {
    endDate = addDays(startDateStr, durationQuantity);
  } else {
    endDate = addMonthsClamped(startDateStr, durationQuantity);
  }

  const validThrough = addDays(endDate, -1);
  return {
    startDate: startDateStr,
    endDate,
    validThrough,
  };
}

/**
 * Formats a 'YYYY-MM-DD' date into a human readable Indian format: "28 Feb 2027" or "28/02/2027".
 */
export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const { year, month, day } = parseDateString(dateStr.slice(0, 10));
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${day} ${monthNames[month - 1]} ${year}`;
}

/**
 * Determines current membership status based on dates, paused flag, and cancelled flag.
 */
export function deriveMembershipStatus(params: {
  startDate: string;
  endDate: string;
  isPaused?: boolean;
  isCancelled?: boolean;
  referenceDate?: string;
}): "UPCOMING" | "ACTIVE" | "PAUSED" | "EXPIRED" | "CANCELLED" {
  const { startDate, endDate, isPaused, isCancelled, referenceDate } = params;
  const today = referenceDate || getTodayISTString();

  if (isCancelled) return "CANCELLED";
  if (isPaused) return "PAUSED";
  if (today < startDate) return "UPCOMING";
  if (today >= endDate) return "EXPIRED";
  return "ACTIVE";
}

