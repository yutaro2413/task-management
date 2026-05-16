import { describe, it, expect } from "vitest";
import { calcGymStats, toDateKey } from "./gymStats";

const START = "2026-04-19";

describe("toDateKey", () => {
  it("YYYY-MM-DD はそのまま", () => {
    expect(toDateKey("2026-04-20")).toBe("2026-04-20");
  });
  it("ISO 文字列は日付部分のみ", () => {
    expect(toDateKey("2026-04-20T15:30:00Z")).toBe("2026-04-20");
  });
});

describe("calcGymStats", () => {
  it("開始日当日 1 件: 1 日経過、週平均 7、月平均 30.4", () => {
    const r = calcGymStats(["2026-04-19"], new Date("2026-04-19T00:00:00Z"), START);
    expect(r.visits).toBe(1);
    expect(r.daysElapsed).toBe(1);
    expect(r.weeklyAvg).toBe(7);
    expect(r.monthlyAvg).toBeCloseTo(30.4375, 3);
  });

  it("4/19-4/30 (12日) で 5 回 → 月平均 ≈ 12.7", () => {
    const dates = ["2026-04-19", "2026-04-21", "2026-04-24", "2026-04-27", "2026-04-30"];
    const r = calcGymStats(dates, new Date("2026-04-30T00:00:00Z"), START);
    expect(r.visits).toBe(5);
    expect(r.daysElapsed).toBe(12);
    expect(r.weeklyAvg).toBeCloseTo(5 / (12 / 7), 2); // ≈ 2.92
    expect(r.monthlyAvg).toBeCloseTo(5 * 30.4375 / 12, 2); // ≈ 12.68
  });

  it("ちょうど 30 日経過で 10 回 → 月平均 ≈ 10.1", () => {
    // 4/19 から 30 日後 = 5/18
    const dates: string[] = [];
    for (let d = 19; d <= 30; d += 3) dates.push(`2026-04-${String(d).padStart(2, "0")}`);
    for (let d = 1; d <= 18; d += 3) dates.push(`2026-05-${String(d).padStart(2, "0")}`);
    const r = calcGymStats(dates, new Date("2026-05-18T00:00:00Z"), START);
    expect(r.daysElapsed).toBe(30);
    expect(r.visits).toBe(dates.length);
  });

  it("ISO 形式の日付配列でも動く", () => {
    const r = calcGymStats(["2026-04-20T15:00:00Z", "2026-04-22T00:00:00Z"], new Date("2026-04-30T00:00:00Z"), START);
    expect(r.visits).toBe(2);
  });

  it("開始日より前の日付は集計に含めない", () => {
    const r = calcGymStats(["2026-04-15", "2026-04-19", "2026-04-22"], new Date("2026-04-22T00:00:00Z"), START);
    expect(r.visits).toBe(2);
  });

  it("未来日付は集計しない (今日まで)", () => {
    const r = calcGymStats(["2026-04-19", "2099-12-31"], new Date("2026-04-30T00:00:00Z"), START);
    expect(r.visits).toBe(1);
  });

  it("重複日付は 1 件として数える", () => {
    const r = calcGymStats(["2026-04-19", "2026-04-19", "2026-04-20"], new Date("2026-04-30T00:00:00Z"), START);
    expect(r.visits).toBe(2);
  });

  it("開始日より前の today では 0 件・日数 1", () => {
    // 念のため: today < start のケース (現実には起きないが)
    const r = calcGymStats([], new Date("2026-04-01T00:00:00Z"), START);
    expect(r.visits).toBe(0);
    expect(r.daysElapsed).toBe(1);
  });
});
