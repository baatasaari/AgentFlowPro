// India public holidays — central gazetted holidays + major state additions
// Used for availability checking: appointments cannot be booked on public holidays
// unless business explicitly marks itself as open.

export interface Holiday {
  date: string;       // "MM-DD" or "YYYY-MM-DD" for fixed-date holidays
  name: string;
  nameHi?: string;    // Hindi name
  type: "central" | "state" | "restricted"; // restricted = optional
  states?: string[];  // if empty → applies nationally
  dynamic?: true;     // computed algorithmically (e.g. Diwali changes yearly)
}

// ─── Fixed-date national holidays ────────────────────────────────────────────
export const FIXED_HOLIDAYS: Holiday[] = [
  { date: "01-26", name: "Republic Day", nameHi: "गणतंत्र दिवस", type: "central" },
  { date: "08-15", name: "Independence Day", nameHi: "स्वतंत्रता दिवस", type: "central" },
  { date: "10-02", name: "Gandhi Jayanti", nameHi: "गांधी जयंती", type: "central" },
  { date: "12-25", name: "Christmas Day", nameHi: "क्रिसमस", type: "central" },

  // Restricted / optional (most businesses close anyway)
  { date: "01-01", name: "New Year's Day", type: "restricted" },
  { date: "11-14", name: "Children's Day", nameHi: "बाल दिवस", type: "restricted" },
  { date: "09-05", name: "Teachers' Day", nameHi: "शिक्षक दिवस", type: "restricted" },
];

// ─── Dynamic holidays (year-specific for 2024–2027) ─────────────────────────
// Source: Government of India official calendar + major religious calendars
// Format: "YYYY-MM-DD"
const DYNAMIC_HOLIDAYS_BY_YEAR: Record<number, Holiday[]> = {
  2024: [
    { date: "2024-01-14", name: "Makar Sankranti / Pongal", nameHi: "मकर संक्रांति", type: "central" },
    { date: "2024-01-15", name: "Pongal", type: "state", states: ["TN", "AP", "TS"] },
    { date: "2024-01-22", name: "Ram Mandir Pran Pratishtha", type: "restricted" },
    { date: "2024-02-14", name: "Basant Panchami", nameHi: "बसंत पंचमी", type: "restricted" },
    { date: "2024-03-08", name: "Maha Shivaratri", nameHi: "महाशिवरात्रि", type: "central" },
    { date: "2024-03-25", name: "Holi", nameHi: "होली", type: "central" },
    { date: "2024-03-29", name: "Good Friday", type: "central" },
    { date: "2024-04-09", name: "Gudi Padwa / Ugadi", type: "state", states: ["MH", "AP", "TS", "KA"] },
    { date: "2024-04-11", name: "Id-ul-Fitr (Eid)", nameHi: "ईद-उल-फितर", type: "central" },
    { date: "2024-04-14", name: "Dr. Ambedkar Jayanti", nameHi: "डॉ. अम्बेडकर जयंती", type: "central" },
    { date: "2024-04-14", name: "Tamil New Year (Puthandu)", type: "state", states: ["TN"] },
    { date: "2024-04-17", name: "Ram Navami", nameHi: "राम नवमी", type: "central" },
    { date: "2024-05-23", name: "Buddha Purnima", nameHi: "बुद्ध पूर्णिमा", type: "central" },
    { date: "2024-06-17", name: "Eid ul-Adha (Bakrid)", nameHi: "बकरीद", type: "central" },
    { date: "2024-07-17", name: "Muharram", type: "central" },
    { date: "2024-08-19", name: "Raksha Bandhan", nameHi: "रक्षाबंधन", type: "restricted" },
    { date: "2024-08-26", name: "Janmashtami", nameHi: "जन्माष्टमी", type: "central" },
    { date: "2024-09-16", name: "Milad-un-Nabi", type: "central" },
    { date: "2024-10-02", name: "Gandhi Jayanti / Navratri", type: "central" },
    { date: "2024-10-12", name: "Dussehra", nameHi: "दशहरा", type: "central" },
    { date: "2024-10-31", name: "Diwali (Lakshmi Puja)", nameHi: "दीपावली", type: "central" },
    { date: "2024-11-01", name: "Diwali (Padwa / Bali Pratipada)", type: "central" },
    { date: "2024-11-15", name: "Guru Nanak Jayanti", nameHi: "गुरु नानक जयंती", type: "central" },
  ],
  2025: [
    { date: "2025-01-14", name: "Makar Sankranti / Pongal", type: "central" },
    { date: "2025-02-02", name: "Basant Panchami", type: "restricted" },
    { date: "2025-02-26", name: "Maha Shivaratri", type: "central" },
    { date: "2025-03-14", name: "Holi", nameHi: "होली", type: "central" },
    { date: "2025-03-31", name: "Eid-ul-Fitr", type: "central" },
    { date: "2025-04-02", name: "Ram Navami", type: "central" },
    { date: "2025-04-06", name: "Gudi Padwa / Ugadi", type: "state", states: ["MH", "AP", "TS", "KA"] },
    { date: "2025-04-14", name: "Dr. Ambedkar Jayanti", type: "central" },
    { date: "2025-04-14", name: "Tamil New Year", type: "state", states: ["TN"] },
    { date: "2025-04-18", name: "Good Friday", type: "central" },
    { date: "2025-05-12", name: "Buddha Purnima", type: "central" },
    { date: "2025-06-07", name: "Eid ul-Adha", type: "central" },
    { date: "2025-07-06", name: "Muharram", type: "central" },
    { date: "2025-08-09", name: "Raksha Bandhan", type: "restricted" },
    { date: "2025-08-16", name: "Janmashtami", type: "central" },
    { date: "2025-09-05", name: "Milad-un-Nabi", type: "central" },
    { date: "2025-10-02", name: "Gandhi Jayanti", type: "central" },
    { date: "2025-10-02", name: "Navratri Start", type: "restricted" },
    { date: "2025-10-20", name: "Diwali (Lakshmi Puja)", nameHi: "दीपावली", type: "central" },
    { date: "2025-10-21", name: "Diwali (Padwa)", type: "central" },
    { date: "2025-11-05", name: "Guru Nanak Jayanti", type: "central" },
    { date: "2025-10-02", name: "Dussehra", type: "central" },
  ],
  2026: [
    { date: "2026-01-14", name: "Makar Sankranti", type: "central" },
    { date: "2026-02-17", name: "Maha Shivaratri", type: "central" },
    { date: "2026-03-03", name: "Holi", type: "central" },
    { date: "2026-03-20", name: "Eid-ul-Fitr", type: "central" },
    { date: "2026-03-27", name: "Gudi Padwa", type: "state", states: ["MH", "AP", "TS", "KA"] },
    { date: "2026-03-28", name: "Ram Navami", type: "central" },
    { date: "2026-04-03", name: "Good Friday", type: "central" },
    { date: "2026-04-14", name: "Dr. Ambedkar Jayanti", type: "central" },
    { date: "2026-04-14", name: "Tamil New Year", type: "state", states: ["TN"] },
    { date: "2026-05-01", name: "Buddha Purnima", type: "central" },
    { date: "2026-05-27", name: "Eid ul-Adha", type: "central" },
    { date: "2026-06-26", name: "Muharram", type: "central" },
    { date: "2026-07-30", name: "Raksha Bandhan", type: "restricted" },
    { date: "2026-08-05", name: "Janmashtami", type: "central" },
    { date: "2026-08-25", name: "Milad-un-Nabi", type: "central" },
    { date: "2026-10-20", name: "Dussehra", type: "central" },
    { date: "2026-11-08", name: "Diwali", nameHi: "दीपावली", type: "central" },
    { date: "2026-11-25", name: "Guru Nanak Jayanti", type: "central" },
  ],
};

// ─── State-specific additional holidays ──────────────────────────────────────
export const STATE_HOLIDAYS: Record<string, Holiday[]> = {
  MH: [ // Maharashtra
    { date: "05-01", name: "Maharashtra Day", type: "state", states: ["MH"] },
    { date: "04-14", name: "Dr. Ambedkar Jayanti", type: "state", states: ["MH"] },
  ],
  TN: [ // Tamil Nadu
    { date: "01-15", name: "Pongal", type: "state", states: ["TN"] },
    { date: "04-14", name: "Tamil New Year", type: "state", states: ["TN"] },
    { date: "11-01", name: "Tamil Nadu Formation Day", type: "state", states: ["TN"] },
  ],
  KA: [ // Karnataka
    { date: "11-01", name: "Rajyotsava (Karnataka Day)", type: "state", states: ["KA"] },
    { date: "11-01", name: "Kannada Rajyotsava", type: "state", states: ["KA"] },
  ],
  KL: [ // Kerala
    { date: "08-15", name: "Onam (approximate)", type: "state", states: ["KL"] },
  ],
  WB: [ // West Bengal
    { date: "10-15", name: "Durga Puja (approx)", type: "state", states: ["WB"] },
  ],
  GJ: [ // Gujarat
    { date: "01-14", name: "Uttarayan (Makar Sankranti)", type: "state", states: ["GJ"] },
    { date: "05-01", name: "Gujarat Day", type: "state", states: ["GJ"] },
  ],
  PB: [ // Punjab
    { date: "04-13", name: "Vaisakhi / Baisakhi", type: "state", states: ["PB", "HR", "HP"] },
  ],
  HR: [ // Haryana
    { date: "04-13", name: "Baisakhi", type: "state", states: ["HR", "PB"] },
    { date: "11-01", name: "Haryana Day", type: "state", states: ["HR"] },
  ],
};

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Returns all holiday dates (as "YYYY-MM-DD") for a given year,
 * optionally filtered to a specific Indian state code (e.g. "MH", "TN").
 */
export function getHolidaysForYear(year: number, stateCode?: string): Map<string, Holiday> {
  const map = new Map<string, Holiday>();

  // Fixed date holidays
  for (const h of FIXED_HOLIDAYS) {
    const dateStr = `${year}-${h.date}`;
    if (!stateCode || !h.states || h.states.includes(stateCode)) {
      map.set(dateStr, h);
    }
  }

  // Dynamic holidays for the year
  const dynamic = DYNAMIC_HOLIDAYS_BY_YEAR[year] || [];
  for (const h of dynamic) {
    if (!stateCode || !h.states || h.states.length === 0 || h.states.includes(stateCode)) {
      map.set(h.date, h);
    }
  }

  // State-specific fixed holidays
  if (stateCode && STATE_HOLIDAYS[stateCode]) {
    for (const h of STATE_HOLIDAYS[stateCode]) {
      const dateStr = `${year}-${h.date}`;
      if (!map.has(dateStr)) map.set(dateStr, h);
    }
  }

  return map;
}

/**
 * Returns true if the given date is a public holiday in India.
 * @param date - JS Date object (or ISO string "YYYY-MM-DD")
 * @param stateCode - optional two-letter state code (e.g. "MH")
 */
export function isIndianHoliday(date: Date | string, stateCode?: string): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const key = `${year}-${mm}-${dd}`;
  const holidays = getHolidaysForYear(year, stateCode);
  return holidays.has(key);
}

/**
 * Returns the holiday info if date is a holiday, else null.
 */
export function getHolidayInfo(date: Date | string, stateCode?: string): Holiday | null {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const key = `${year}-${mm}-${dd}`;
  return getHolidaysForYear(year, stateCode).get(key) ?? null;
}

/**
 * Returns upcoming holidays in the next N days from today.
 */
export function getUpcomingHolidays(days = 30, stateCode?: string): Array<{ date: string; holiday: Holiday }> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + days);

  const yearSet = [today.getFullYear(), end.getFullYear()].filter((v, i, a) => a.indexOf(v) === i);
  const results: Array<{ date: string; holiday: Holiday }> = [];

  for (const year of yearSet) {
    const holidays = getHolidaysForYear(year, stateCode);
    for (const [dateStr, holiday] of Array.from(holidays)) {
      const d = new Date(dateStr);
      if (d >= today && d <= end) {
        results.push({ date: dateStr, holiday });
      }
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Returns true if a date falls in a major Indian festival season
 * (businesses may have higher/lower demand).
 */
export function isFestivalSeason(date: Date | string): { isSeason: boolean; season?: string } {
  const d = typeof date === "string" ? new Date(date) : date;
  const mm = d.getMonth() + 1;
  const dd = d.getDate();

  // Diwali season: Oct 15 – Nov 10
  if ((mm === 10 && dd >= 15) || (mm === 11 && dd <= 10)) {
    return { isSeason: true, season: "Diwali" };
  }
  // Navratri/Durga Puja: first 10 days of October
  if (mm === 10 && dd <= 14) {
    return { isSeason: true, season: "Navratri / Durga Puja" };
  }
  // Holi season: last week of Feb / first week of March
  if ((mm === 2 && dd >= 22) || (mm === 3 && dd <= 7)) {
    return { isSeason: true, season: "Holi" };
  }
  // Eid season (approximate, varies by year) — March/April
  if (mm === 3 && dd >= 20 || mm === 4 && dd <= 15) {
    return { isSeason: true, season: "Eid" };
  }
  // Christmas / New Year
  if (mm === 12 && dd >= 20 || mm === 1 && dd <= 5) {
    return { isSeason: true, season: "Christmas / New Year" };
  }

  return { isSeason: false };
}
