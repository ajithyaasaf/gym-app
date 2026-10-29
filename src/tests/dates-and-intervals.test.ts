import { describe, it, expect } from "vitest";
import {
  addDays,
  addMonthsClamped,
  calculateTermDates,
  isLeapYear,
  getDaysInMonth,
  differenceInCalendarDays,
  formatDisplayDate,
  deriveMembershipStatus,
} from "@/lib/dates";

describe("Date Rules, Interval Calculations, and Clamping (Scenario 8 & 9)", () => {
  it("correctly identifies leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2027)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });

  it("returns correct days in month including February leap year", () => {
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2028, 2)).toBe(29);
    expect(getDaysInMonth(2026, 1)).toBe(31);
    expect(getDaysInMonth(2026, 4)).toBe(30);
  });

  it("adds exact days accurately", () => {
    expect(addDays("2026-01-01", 30)).toBe("2026-01-31");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("computes calendar day differences accurately", () => {
    expect(differenceInCalendarDays("2026-02-05", "2026-02-01")).toBe(4);
    expect(differenceInCalendarDays("2026-03-01", "2026-02-28")).toBe(1);
    expect(differenceInCalendarDays("2028-03-01", "2028-02-28")).toBe(2); // leap year 29 Feb
  });

  it("applies clamp-to-last-valid-day rule for calendar months (Scenario 9)", () => {
    // 31 January 2027 + 1 month has end-exclusive 28 February 2027
    expect(addMonthsClamped("2027-01-31", 1)).toBe("2027-02-28");

    // 31 January 2028 (leap year) + 1 month has end-exclusive 29 February 2028
    expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29");

    // 31 March 2027 + 1 month has end-exclusive 30 April 2027
    expect(addMonthsClamped("2027-03-31", 1)).toBe("2027-04-30");

    // 31 August 2026 + 1 month has end-exclusive 30 September 2026
    expect(addMonthsClamped("2026-08-31", 1)).toBe("2026-09-30");
  });

  it("calculates half-open intervals and valid-through display date (Scenario 8 & 9)", () => {
    // 30-day plan starting 2026-11-01
    const dayTerm = calculateTermDates("2026-11-01", "DAYS", 30);
    expect(dayTerm.startDate).toBe("2026-11-01");
    expect(dayTerm.endDate).toBe("2026-12-01"); // exclusive
    expect(dayTerm.validThrough).toBe("2026-11-30"); // display valid-through

    // 1-month plan starting 31 Jan 2027
    const monthTerm = calculateTermDates("2027-01-31", "MONTHS", 1);
    expect(monthTerm.startDate).toBe("2027-01-31");
    expect(monthTerm.endDate).toBe("2027-02-28"); // end-exclusive
    expect(monthTerm.validThrough).toBe("2027-02-27"); // displayed valid through 27 Feb
  });

  it("derives correct membership status based on reference dates", () => {
    // Current active
    expect(
      deriveMembershipStatus({
        startDate: "2026-10-01",
        endDate: "2026-11-01",
        referenceDate: "2026-10-15",
      })
    ).toBe("ACTIVE");

    // Upcoming
    expect(
      deriveMembershipStatus({
        startDate: "2026-11-01",
        endDate: "2026-12-01",
        referenceDate: "2026-10-15",
      })
    ).toBe("UPCOMING");

    // Expired
    expect(
      deriveMembershipStatus({
        startDate: "2026-09-01",
        endDate: "2026-10-01",
        referenceDate: "2026-10-15",
      })
    ).toBe("EXPIRED");

    // Paused
    expect(
      deriveMembershipStatus({
        startDate: "2026-10-01",
        endDate: "2026-11-01",
        isPaused: true,
        referenceDate: "2026-10-15",
      })
    ).toBe("PAUSED");

    // Cancelled
    expect(
      deriveMembershipStatus({
        startDate: "2026-10-01",
        endDate: "2026-11-01",
        isCancelled: true,
        referenceDate: "2026-10-15",
      })
    ).toBe("CANCELLED");
  });

  it("formats dates into readable human format", () => {
    expect(formatDisplayDate("2027-02-27")).toBe("27 Feb 2027");
    expect(formatDisplayDate("2026-10-29")).toBe("29 Oct 2026");
    expect(formatDisplayDate(null)).toBe("—");
  });
});

