export type RecurrenceType =
  | "daily"
  | "weekly"
  | "weekdays"
  | "monthly_nth_weekday"
  | "monthly_day"
  | "yearly"
  | "custom";

export type RecurrenceRule = {
  type: RecurrenceType;
  interval?: number;
  customUnit?: "day" | "week";
  daysOfWeek?: number[]; // 0=Sun .. 6=Sat
};

export const RECURRENCE_OPTIONS: { value: RecurrenceType | "none"; label: string }[] = [
  { value: "none", label: "繰り返しなし" },
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "weekdays", label: "毎週平日(月〜金)" },
  { value: "monthly_nth_weekday", label: "毎月第N○曜日" },
  { value: "monthly_day", label: "毎月○日" },
  { value: "yearly", label: "毎年" },
  { value: "custom", label: "カスタム設定" },
];

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date | null {
  const first = new Date(year, month, 1);
  const day = first.getDay();
  let date = 1 + ((weekday - day + 7) % 7);
  date += (n - 1) * 7;
  const result = new Date(year, month, date);
  if (result.getMonth() !== month) return null;
  return result;
}

function getWeekOfMonth(d: Date): number {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const day = first.getDay();
  let date = 1 + ((d.getDay() - day + 7) % 7);
  let week = 1;
  while (date < d.getDate()) {
    date += 7;
    week++;
  }
  return week;
}

export function expandRecurrence(
  rule: RecurrenceRule,
  startDate: string,
  recurrenceEnd: string | null,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const origin = parseDate(startDate);
  const rStart = parseDate(rangeStart);
  const rEnd = parseDate(rangeEnd);
  const end = recurrenceEnd ? parseDate(recurrenceEnd) : null;
  const effectiveEnd = end && end < rEnd ? end : rEnd;

  const dates: string[] = [];

  switch (rule.type) {
    case "daily": {
      let d = new Date(origin);
      while (d <= effectiveEnd) {
        if (d >= rStart) dates.push(dateKey(d));
        d = addDays(d, 1);
      }
      break;
    }

    case "weekly": {
      let d = new Date(origin);
      while (d <= effectiveEnd) {
        if (d >= rStart) dates.push(dateKey(d));
        d = addDays(d, 7);
      }
      break;
    }

    case "weekdays": {
      let d = new Date(origin);
      if (d < rStart) {
        const diff = Math.floor((rStart.getTime() - d.getTime()) / 86400000);
        d = addDays(d, diff);
      }
      while (d <= effectiveEnd) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) {
          dates.push(dateKey(d));
        }
        d = addDays(d, 1);
      }
      break;
    }

    case "monthly_nth_weekday": {
      const weekday = origin.getDay();
      const week = getWeekOfMonth(origin);
      let year = origin.getFullYear();
      let month = origin.getMonth();
      const startMonth = rStart.getFullYear() * 12 + rStart.getMonth();
      const originMonth = year * 12 + month;
      if (startMonth > originMonth) {
        year = rStart.getFullYear();
        month = rStart.getMonth();
      }
      while (true) {
        const d = getNthWeekdayOfMonth(year, month, weekday, week);
        if (d && d > effectiveEnd) break;
        if (d && d >= rStart && d >= origin) dates.push(dateKey(d));
        month++;
        if (month > 11) { month = 0; year++; }
        if (new Date(year, month, 1) > effectiveEnd) break;
      }
      break;
    }

    case "monthly_day": {
      const dayOfMonth = origin.getDate();
      let year = origin.getFullYear();
      let month = origin.getMonth();
      const startMonth = rStart.getFullYear() * 12 + rStart.getMonth();
      const originMonth = year * 12 + month;
      if (startMonth > originMonth) {
        year = rStart.getFullYear();
        month = rStart.getMonth();
      }
      while (true) {
        const lastDay = new Date(year, month + 1, 0).getDate();
        const actualDay = Math.min(dayOfMonth, lastDay);
        const d = new Date(year, month, actualDay);
        if (d > effectiveEnd) break;
        if (d >= rStart && d >= origin) dates.push(dateKey(d));
        month++;
        if (month > 11) { month = 0; year++; }
      }
      break;
    }

    case "yearly": {
      let year = origin.getFullYear();
      if (rStart.getFullYear() > year) year = rStart.getFullYear();
      while (true) {
        const d = new Date(year, origin.getMonth(), origin.getDate());
        if (d > effectiveEnd) break;
        if (d >= rStart && d >= origin) dates.push(dateKey(d));
        year++;
      }
      break;
    }

    case "custom": {
      const interval = rule.interval || 1;
      const unit = rule.customUnit || "day";
      if (unit === "day") {
        let d = new Date(origin);
        while (d <= effectiveEnd) {
          if (d >= rStart) dates.push(dateKey(d));
          d = addDays(d, interval);
        }
      } else {
        // week-based with optional daysOfWeek
        const daysOfWeek = rule.daysOfWeek || [origin.getDay()];
        let weekStart = new Date(origin);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        while (weekStart <= effectiveEnd) {
          for (const dow of daysOfWeek) {
            const d = addDays(weekStart, dow);
            if (d >= origin && d >= rStart && d <= effectiveEnd) {
              dates.push(dateKey(d));
            }
          }
          weekStart = addDays(weekStart, 7 * interval);
        }
      }
      break;
    }
  }

  return dates;
}

export function describeRecurrence(rule: RecurrenceRule, startDate: string): string {
  const origin = parseDate(startDate);
  switch (rule.type) {
    case "daily":
      return "毎日";
    case "weekly":
      return `毎週${DAY_NAMES[origin.getDay()]}曜日`;
    case "weekdays":
      return "毎週平日(月〜金)";
    case "monthly_nth_weekday": {
      const week = getWeekOfMonth(origin);
      return `毎月第${week}${DAY_NAMES[origin.getDay()]}曜日`;
    }
    case "monthly_day":
      return `毎月${origin.getDate()}日`;
    case "yearly":
      return `毎年${origin.getMonth() + 1}月${origin.getDate()}日`;
    case "custom": {
      const interval = rule.interval || 1;
      const unit = rule.customUnit || "day";
      if (unit === "day") {
        return interval === 1 ? "毎日" : `${interval}日ごと`;
      }
      const days = (rule.daysOfWeek || []).map((d) => DAY_NAMES[d]).join("・");
      return interval === 1
        ? `毎週${days || DAY_NAMES[origin.getDay()]}曜日`
        : `${interval}週ごと(${days || DAY_NAMES[origin.getDay()]})`;
    }
  }
}

export function getRecurrenceLabelForDate(rule: RecurrenceRule, startDate: string): string {
  const origin = parseDate(startDate);
  const dow = origin.getDay();

  switch (rule.type) {
    case "weekly":
      return `毎週${DAY_NAMES[dow]}曜日`;
    case "monthly_nth_weekday": {
      const week = getWeekOfMonth(origin);
      return `毎月第${week}${DAY_NAMES[dow]}曜日`;
    }
    case "monthly_day":
      return `毎月${origin.getDate()}日`;
    default:
      return describeRecurrence(rule, startDate);
  }
}
