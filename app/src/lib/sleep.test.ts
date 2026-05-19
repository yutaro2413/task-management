import { describe, it, expect } from "vitest";
import { smartReplaceSleepTime } from "./sleep";

const HOUR_MS = 60 * 60 * 1000;

// JST の "YYYY-MM-DD HH:MM" を ISO に変換するテスト用ヘルパー
function jstIso(y: number, m: number, d: number, hh: number, mm: number): string {
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0) - 9 * HOUR_MS;
  return new Date(utcMs).toISOString();
}

function diffHours(a: string, b: string): number {
  return (new Date(a).getTime() - new Date(b).getTime()) / HOUR_MS;
}

describe("smartReplaceSleepTime", () => {
  it("villaバグ再現: wake=5/19 09:24, sleep を 01:21 に編集 → 5/19 01:21 (dur≈8h)", () => {
    const wake = jstIso(2026, 5, 19, 9, 24);
    const result = smartReplaceSleepTime("01:21", wake, "sleep");
    expect(diffHours(wake, result)).toBeCloseTo(8.05, 1);
    expect(result).toBe(jstIso(2026, 5, 19, 1, 21));
  });

  it("通常: wake=5/19 07:00, sleep を 23:30 に編集 → 5/18 23:30 (前日夜)", () => {
    const wake = jstIso(2026, 5, 19, 7, 0);
    const result = smartReplaceSleepTime("23:30", wake, "sleep");
    expect(diffHours(wake, result)).toBeCloseTo(7.5, 1);
    expect(result).toBe(jstIso(2026, 5, 18, 23, 30));
  });

  it("wakeAt 編集: sleep=5/18 23:30, wake を 07:00 に編集 → 5/19 07:00", () => {
    const sleep = jstIso(2026, 5, 18, 23, 30);
    const result = smartReplaceSleepTime("07:00", sleep, "wake");
    expect(diffHours(result, sleep)).toBeCloseTo(7.5, 1);
    expect(result).toBe(jstIso(2026, 5, 19, 7, 0));
  });

  it("wakeAt 編集: sleep=5/18 23:30, wake を 11:30 (long sleep) → 5/19 11:30 (dur=12h)", () => {
    const sleep = jstIso(2026, 5, 18, 23, 30);
    const result = smartReplaceSleepTime("11:30", sleep, "wake");
    expect(diffHours(result, sleep)).toBeCloseTo(12, 1);
    expect(result).toBe(jstIso(2026, 5, 19, 11, 30));
  });

  it("月跨ぎ: wake=6/1 07:00, sleep を 23:30 に編集 → 5/31 23:30", () => {
    const wake = jstIso(2026, 6, 1, 7, 0);
    const result = smartReplaceSleepTime("23:30", wake, "sleep");
    expect(result).toBe(jstIso(2026, 5, 31, 23, 30));
  });

  it("年跨ぎ: wake=1/1 07:00, sleep を 23:30 に編集 → 12/31 23:30", () => {
    const wake = jstIso(2027, 1, 1, 7, 0);
    const result = smartReplaceSleepTime("23:30", wake, "sleep");
    expect(result).toBe(jstIso(2026, 12, 31, 23, 30));
  });

  it("不正な HH:MM 入力は anchor を返す (no-op)", () => {
    const wake = jstIso(2026, 5, 19, 9, 24);
    expect(smartReplaceSleepTime("abc", wake, "sleep")).toBe(wake);
    expect(smartReplaceSleepTime("", wake, "sleep")).toBe(wake);
  });

  it("早朝 sleep + 朝 wake (同日内): wake=5/19 11:00, sleep を 03:30 → 5/19 03:30 (dur=7.5h)", () => {
    const wake = jstIso(2026, 5, 19, 11, 0);
    const result = smartReplaceSleepTime("03:30", wake, "sleep");
    expect(result).toBe(jstIso(2026, 5, 19, 3, 30));
  });

  it("仮眠想定: wake=5/19 15:00, sleep を 14:00 → 5/19 14:00 (dur=1h)", () => {
    const wake = jstIso(2026, 5, 19, 15, 0);
    const result = smartReplaceSleepTime("14:00", wake, "sleep");
    expect(result).toBe(jstIso(2026, 5, 19, 14, 0));
  });
});
