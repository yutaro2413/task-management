import { describe, it, expect } from "vitest";
import { normalizeWeights } from "./menuWeights";

describe("normalizeWeights", () => {
  it("正常な配列はそのまま", () => {
    const input = [{ locationId: "a", weight: "10" }, { locationId: "b", weight: "20" }];
    expect(normalizeWeights(input)).toEqual(input);
  });

  it("locationId 重複は最初だけ残す", () => {
    const input = [{ locationId: "a", weight: "10" }, { locationId: "a", weight: "99" }];
    expect(normalizeWeights(input)).toEqual([{ locationId: "a", weight: "10" }]);
  });

  it("不正な要素を除外", () => {
    const input = [
      { locationId: "a", weight: "10" },
      { locationId: "", weight: "5" },     // 空 locationId
      { weight: "5" },                       // locationId 無し
      { locationId: "b" },                   // weight 無し
      null,
      "bad",
    ];
    expect(normalizeWeights(input)).toEqual([{ locationId: "a", weight: "10" }]);
  });

  it("配列以外は空配列", () => {
    expect(normalizeWeights(null)).toEqual([]);
    expect(normalizeWeights("x")).toEqual([]);
    expect(normalizeWeights(undefined)).toEqual([]);
  });

  it("空 weight は許容 (場所はあるが未入力)", () => {
    expect(normalizeWeights([{ locationId: "a", weight: "" }])).toEqual([{ locationId: "a", weight: "" }]);
  });
});
