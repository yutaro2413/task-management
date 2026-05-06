import { describe, it, expect } from "vitest";
import { parseWeight, exerciseVolume } from "./workoutVolume";

describe("parseWeight", () => {
  it("数値文字列をパース", () => {
    expect(parseWeight("10")).toBe(10);
    expect(parseWeight("12.5")).toBe(12.5);
  });
  it("kg/㎏/番 を除去してパース", () => {
    expect(parseWeight("10kg")).toBe(10);
    expect(parseWeight("10KG")).toBe(10);
    expect(parseWeight("10㎏")).toBe(10);
    expect(parseWeight("5番")).toBe(5);
  });
  it("丸数字をパース (① ~ ⑳)", () => {
    expect(parseWeight("①")).toBe(1);
    expect(parseWeight("⑩")).toBe(10);
    expect(parseWeight("⑳")).toBe(20);
  });
  it("空・null・パース不能は null", () => {
    expect(parseWeight("")).toBe(null);
    expect(parseWeight("  ")).toBe(null);
    expect(parseWeight("abc")).toBe(null);
  });
});

describe("exerciseVolume", () => {
  it("通常の strength: 重量×回数×セット", () => {
    expect(exerciseVolume({ weight: "10", reps: 5, sets: 3, type: "strength" })).toBe(150);
    expect(exerciseVolume({ weight: "20kg", reps: 10, sets: 4, type: "strength" })).toBe(800);
  });

  it("running は null", () => {
    expect(exerciseVolume({ weight: "5", reps: 1, sets: 1, type: "running" })).toBe(null);
  });

  it("重量が parse 不能なら null", () => {
    expect(exerciseVolume({ weight: "", reps: 5, sets: 3, type: "strength" })).toBe(null);
    expect(exerciseVolume({ weight: "abc", reps: 5, sets: 3, type: "strength" })).toBe(null);
  });

  it("reps/sets が 0 や負値は null", () => {
    expect(exerciseVolume({ weight: "10", reps: 0, sets: 3, type: "strength" })).toBe(null);
    expect(exerciseVolume({ weight: "10", reps: 5, sets: 0, type: "strength" })).toBe(null);
    expect(exerciseVolume({ weight: "10", reps: -1, sets: 3, type: "strength" })).toBe(null);
  });
});
