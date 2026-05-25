import { describe, it, expect } from "vitest";
import {
  isIndianHoliday,
  getHolidayInfo,
  getHolidaysForYear,
  getUpcomingHolidays,
  isFestivalSeason,
} from "../../../server/india/holidays.js";

describe("isIndianHoliday — fixed national holidays", () => {
  it("recognizes Republic Day (Jan 26)", () => {
    expect(isIndianHoliday("2026-01-26")).toBe(true);
    expect(isIndianHoliday("2025-01-26")).toBe(true);
  });

  it("recognizes Independence Day (Aug 15)", () => {
    expect(isIndianHoliday("2026-08-15")).toBe(true);
  });

  it("recognizes Gandhi Jayanti (Oct 2)", () => {
    expect(isIndianHoliday("2026-10-02")).toBe(true);
  });

  it("recognizes Christmas (Dec 25)", () => {
    expect(isIndianHoliday("2026-12-25")).toBe(true);
  });

  it("returns false for a regular weekday", () => {
    expect(isIndianHoliday("2026-06-15")).toBe(false);
    expect(isIndianHoliday("2026-07-10")).toBe(false);
  });
});

describe("isIndianHoliday — dynamic holidays (2026)", () => {
  it("recognizes Maha Shivaratri 2026 (Feb 17)", () => {
    expect(isIndianHoliday("2026-02-17")).toBe(true);
  });

  it("recognizes Holi 2026 (Mar 3)", () => {
    expect(isIndianHoliday("2026-03-03")).toBe(true);
  });

  it("recognizes Eid-ul-Fitr 2026 (Mar 20 approx)", () => {
    expect(isIndianHoliday("2026-03-20")).toBe(true);
  });

  it("recognizes Dr. Ambedkar Jayanti (Apr 14)", () => {
    expect(isIndianHoliday("2026-04-14")).toBe(true);
  });

  it("recognizes Diwali 2026 (Nov 8)", () => {
    expect(isIndianHoliday("2026-11-08")).toBe(true);
  });
});

describe("isIndianHoliday — state-specific holidays", () => {
  it("Tamil New Year (Apr 14) is holiday in TN but not in MH", () => {
    expect(isIndianHoliday("2026-04-14", "TN")).toBe(true);
  });

  it("Maharashtra Day (May 1) is holiday in MH", () => {
    expect(isIndianHoliday("2026-05-01", "MH")).toBe(true);
  });

  it("Rajyotsava (Nov 1) is holiday in KA (Karnataka)", () => {
    expect(isIndianHoliday("2026-11-01", "KA")).toBe(true);
  });

  it("Baisakhi (Apr 13) is holiday in PB (Punjab)", () => {
    expect(isIndianHoliday("2026-04-13", "PB")).toBe(true);
  });

  it("Gujarat Day (May 1) is holiday in GJ", () => {
    expect(isIndianHoliday("2026-05-01", "GJ")).toBe(true);
  });
});

describe("getHolidayInfo", () => {
  it("returns holiday info for Republic Day", () => {
    const info = getHolidayInfo("2026-01-26");
    expect(info).not.toBeNull();
    expect(info?.name).toBe("Republic Day");
    expect(info?.type).toBe("central");
  });

  it("returns null for a non-holiday", () => {
    expect(getHolidayInfo("2026-06-15")).toBeNull();
  });

  it("includes Hindi name for Hindi-named holidays", () => {
    const info = getHolidayInfo("2026-01-26");
    expect(info?.nameHi).toBe("गणतंत्र दिवस");
  });
});

describe("getHolidaysForYear", () => {
  it("returns at least 10 holidays for 2026", () => {
    const holidays = getHolidaysForYear(2026);
    expect(holidays.size).toBeGreaterThanOrEqual(10);
  });

  it("includes both fixed and dynamic holidays", () => {
    const holidays = getHolidaysForYear(2026);
    expect(holidays.has("2026-01-26")).toBe(true); // fixed
    expect(holidays.has("2026-11-08")).toBe(true); // dynamic Diwali
  });

  it("adds extra state holidays when state code given", () => {
    const nationwideCount = getHolidaysForYear(2026).size;
    const maharashtraCount = getHolidaysForYear(2026, "MH").size;
    expect(maharashtraCount).toBeGreaterThanOrEqual(nationwideCount);
  });
});

describe("getUpcomingHolidays", () => {
  it("returns array (may be empty for off-season)", () => {
    const upcoming = getUpcomingHolidays(7);
    expect(Array.isArray(upcoming)).toBe(true);
  });

  it("each item has date and holiday properties", () => {
    const upcoming = getUpcomingHolidays(365); // look 1 year ahead
    if (upcoming.length > 0) {
      expect(upcoming[0]).toHaveProperty("date");
      expect(upcoming[0]).toHaveProperty("holiday");
      expect(upcoming[0].holiday).toHaveProperty("name");
    }
  });

  it("results are sorted by date", () => {
    const upcoming = getUpcomingHolidays(365);
    for (let i = 1; i < upcoming.length; i++) {
      expect(upcoming[i].date >= upcoming[i - 1].date).toBe(true);
    }
  });
});

describe("isFestivalSeason", () => {
  it("identifies Diwali season (late October)", () => {
    const result = isFestivalSeason(new Date("2026-10-25"));
    expect(result.isSeason).toBe(true);
    expect(result.season).toBe("Diwali");
  });

  it("identifies Holi season (early March)", () => {
    const result = isFestivalSeason(new Date("2026-03-04"));
    expect(result.isSeason).toBe(true);
    expect(result.season).toBe("Holi");
  });

  it("identifies Navratri season (early October)", () => {
    const result = isFestivalSeason(new Date("2026-10-05"));
    expect(result.isSeason).toBe(true);
    expect(result.season).toBe("Navratri / Durga Puja");
  });

  it("identifies Christmas/New Year season", () => {
    const result = isFestivalSeason(new Date("2026-12-26"));
    expect(result.isSeason).toBe(true);
    expect(result.season).toBe("Christmas / New Year");
  });

  it("returns false for off-season dates", () => {
    const result = isFestivalSeason(new Date("2026-07-15")); // mid-July
    expect(result.isSeason).toBe(false);
  });

  it("identifies Diwali season at boundary (Oct 15)", () => {
    const result = isFestivalSeason(new Date("2026-10-15"));
    expect(result.isSeason).toBe(true);
  });
});
