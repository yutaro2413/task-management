import { describe, it, expect } from "vitest";
import { scheduleNext, INITIAL_STATE } from "./spacedRepetition";

const FIXED_NOW = new Date("2026-04-30T00:00:00Z");

function daysFrom(now: Date, n: number): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

describe("scheduleNext", () => {
  it("Forgot は interval=1 に reset し ease を下げる", () => {
    const r = scheduleNext({ interval: 30, ease: 2.5, reps: 5 }, 0, FIXED_NOW);
    expect(r.interval).toBe(1);
    expect(r.reps).toBe(0);
    expect(r.ease).toBeCloseTo(2.3, 5);
    expect(r.nextReviewAt.toISOString()).toBe(daysFrom(FIXED_NOW, 1).toISOString());
  });

  it("Forgot で ease は最低 1.3 を下回らない", () => {
    const r = scheduleNext({ interval: 1, ease: 1.3, reps: 0 }, 0, FIXED_NOW);
    expect(r.ease).toBe(1.3);
  });

  it("初回 Good: 2日後", () => {
    const r = scheduleNext(INITIAL_STATE, 2, FIXED_NOW);
    expect(r.interval).toBe(2);
    expect(r.reps).toBe(1);
    expect(r.nextReviewAt.toISOString()).toBe(daysFrom(FIXED_NOW, 2).toISOString());
  });

  it("初回 Easy: 3日後", () => {
    const r = scheduleNext(INITIAL_STATE, 3, FIXED_NOW);
    expect(r.interval).toBe(3);
  });

  it("初回 Hard: 1日後", () => {
    const r = scheduleNext(INITIAL_STATE, 1, FIXED_NOW);
    expect(r.interval).toBe(1);
  });

  it("2 回目 Good: 5日後", () => {
    const after1st = scheduleNext(INITIAL_STATE, 2, FIXED_NOW);
    const after2nd = scheduleNext(after1st, 2, FIXED_NOW);
    expect(after2nd.interval).toBe(5);
    expect(after2nd.reps).toBe(2);
  });

  it("3回目以降 Good は前回 interval × ease で増加", () => {
    const state = { interval: 7, ease: 2.5, reps: 3 };
    const r = scheduleNext(state, 2, FIXED_NOW);
    expect(r.interval).toBe(Math.round(7 * 2.5)); // 18
    expect(r.reps).toBe(4);
  });

  it("Easy は Good より長い間隔になる", () => {
    const state = { interval: 7, ease: 2.5, reps: 3 };
    const good = scheduleNext(state, 2, FIXED_NOW);
    const easy = scheduleNext(state, 3, FIXED_NOW);
    expect(easy.interval).toBeGreaterThan(good.interval);
  });

  it("Hard は Good より短い間隔になる", () => {
    const state = { interval: 7, ease: 2.5, reps: 3 };
    const good = scheduleNext(state, 2, FIXED_NOW);
    const hard = scheduleNext(state, 1, FIXED_NOW);
    expect(hard.interval).toBeLessThan(good.interval);
  });

  it("interval は 365 日を超えない", () => {
    const state = { interval: 300, ease: 3.0, reps: 10 };
    const r = scheduleNext(state, 3, FIXED_NOW);
    expect(r.interval).toBeLessThanOrEqual(365);
  });

  it("ease が壊れた値でも DEFAULT で動く", () => {
    const r = scheduleNext({ interval: 0, ease: NaN, reps: 0 }, 2, FIXED_NOW);
    expect(r.interval).toBe(2);
    expect(r.ease).toBeGreaterThan(0);
  });
});
