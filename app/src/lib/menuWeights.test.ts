import { describe, it, expect } from "vitest";
import { resolveMenuWeight, normalizeWeights } from "./menuWeights";

describe("resolveMenuWeight", () => {
  const menu = {
    defaultWeight: "20",
    weights: [
      { locationId: "locA", weight: "60" },
      { locationId: "locB", weight: "50" },
    ],
  };

  it("場所別の重量を返す", () => {
    expect(resolveMenuWeight(menu, "locA")).toBe("60");
    expect(resolveMenuWeight(menu, "locB")).toBe("50");
  });

  it("場所別設定が無い locationId は defaultWeight", () => {
    expect(resolveMenuWeight(menu, "locC")).toBe("20");
  });

  it("locationId 未指定/null は defaultWeight", () => {
    expect(resolveMenuWeight(menu, null)).toBe("20");
    expect(resolveMenuWeight(menu, undefined)).toBe("20");
  });

  it("場所別 weight が空文字なら defaultWeight にフォールバック", () => {
    const m = { defaultWeight: "20", weights: [{ locationId: "locA", weight: "" }] };
    expect(resolveMenuWeight(m, "locA")).toBe("20");
  });

  it("weights が無いメニューは defaultWeight", () => {
    expect(resolveMenuWeight({ defaultWeight: "30" }, "locA")).toBe("30");
    expect(resolveMenuWeight({ defaultWeight: "30", weights: null }, "locA")).toBe("30");
  });
});

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
