import { describe, it, expect } from "vitest";
import {
  resolveMenuWeight,
  normalizeWeights,
  resolveExercisePrefill,
  applyMasterWeights,
  logDateKey,
  isLatestLogForMenu,
} from "./menuWeights";

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

describe("resolveExercisePrefill", () => {
  const bench = {
    id: "bench",
    defaultWeight: "20",
    weights: [{ locationId: "locA", weight: "40" }],
    defaultReps: 10,
    defaultSets: 3,
  };

  it("入力中の行が無ければマスタ (場所別重量 + 既定回数/set)", () => {
    expect(resolveExercisePrefill(bench, "locA", [])).toEqual({ weight: "40", reps: 10, sets: 3 });
  });

  it("同じメニューを入力中なら、その行の値を引き継ぐ (2セット目の追加)", () => {
    const current = [{ menuId: "bench", weight: "45", reps: 8, sets: 2, type: "strength" }];
    expect(resolveExercisePrefill(bench, "locA", current)).toEqual({ weight: "45", reps: 8, sets: 2 });
  });

  it("同じメニューが複数行あれば最後の行を引き継ぐ", () => {
    const current = [
      { menuId: "bench", weight: "45", reps: 8, sets: 2, type: "strength" },
      { menuId: "bench", weight: "50", reps: 6, sets: 1, type: "strength" },
    ];
    expect(resolveExercisePrefill(bench, "locA", current)).toEqual({ weight: "50", reps: 6, sets: 1 });
  });

  it("別メニューの行は引き継がない", () => {
    const current = [{ menuId: "squat", weight: "80", reps: 5, sets: 5, type: "strength" }];
    expect(resolveExercisePrefill(bench, "locA", current)).toEqual({ weight: "40", reps: 10, sets: 3 });
  });

  it("入力中の重量が空ならマスタの重量に戻す (回数/set は行の値)", () => {
    const current = [{ menuId: "bench", weight: "  ", reps: 8, sets: 2, type: "strength" }];
    expect(resolveExercisePrefill(bench, "locA", current)).toEqual({ weight: "40", reps: 8, sets: 2 });
  });

  it("場所別設定が無い場所は defaultWeight", () => {
    expect(resolveExercisePrefill(bench, "locZ", [])).toEqual({ weight: "20", reps: 10, sets: 3 });
  });
});

describe("applyMasterWeights", () => {
  const menus = [
    { id: "bench", defaultWeight: "20", weights: [{ locationId: "locA", weight: "40" }], defaultReps: 10, defaultSets: 3 },
    { id: "squat", defaultWeight: "", weights: [], defaultReps: 10, defaultSets: 3 },
  ];

  it("選択中の場所のマスタ重量で上書きする", () => {
    const carried = [{ menuId: "bench", weight: "30", reps: 10, sets: 3, type: "strength" }];
    expect(applyMasterWeights(carried, menus, "locA")[0].weight).toBe("40");
  });

  it("マスタ側が空なら記録の値を残す", () => {
    const carried = [{ menuId: "squat", weight: "80", reps: 5, sets: 5, type: "strength" }];
    expect(applyMasterWeights(carried, menus, "locA")[0].weight).toBe("80");
  });

  it("menuId 無し / ランニング / 未知のメニューはそのまま", () => {
    const carried = [
      { weight: "99", reps: 1, sets: 1, type: "strength" },
      { menuId: "bench", weight: "99", reps: 0, sets: 0, type: "running" },
      { menuId: "unknown", weight: "99", reps: 1, sets: 1, type: "strength" },
    ];
    expect(applyMasterWeights(carried, menus, "locA").map((e) => e.weight)).toEqual(["99", "99", "99"]);
  });

  it("他のフィールドは保持する", () => {
    const carried = [{ menuId: "bench", name: "ベンチ", weight: "30", reps: 8, sets: 4, type: "strength" }];
    expect(applyMasterWeights(carried, menus, "locA")[0]).toEqual({
      menuId: "bench", name: "ベンチ", weight: "40", reps: 8, sets: 4, type: "strength",
    });
  });
});

describe("logDateKey", () => {
  it("ISO 文字列から日付部分を取り出す", () => {
    expect(logDateKey("2026-09-16T00:00:00.000Z")).toBe("2026-09-16");
  });
  it("既に YYYY-MM-DD ならそのまま", () => {
    expect(logDateKey("2026-09-16")).toBe("2026-09-16");
  });
});

describe("isLatestLogForMenu", () => {
  const logs = [
    { date: "2026-09-16T00:00:00.000Z", exercises: [{ menuId: "bench" }] },
    { date: "2026-09-14T00:00:00.000Z", exercises: [{ menuId: "bench" }, { menuId: "squat" }] },
    { date: "2026-09-10T00:00:00.000Z", exercises: [{ menuId: "squat" }] },
  ];

  it("最新のログなら true", () => {
    expect(isLatestLogForMenu(logs, "bench", "2026-09-16")).toBe(true);
    expect(isLatestLogForMenu(logs, "squat", "2026-09-14")).toBe(true);
  });

  it("より新しい記録があれば false (過去ログ修正でマスタを巻き戻さない)", () => {
    expect(isLatestLogForMenu(logs, "bench", "2026-09-14")).toBe(false);
    expect(isLatestLogForMenu(logs, "squat", "2026-09-10")).toBe(false);
  });

  it("新しいログに同じメニューが無ければ true", () => {
    expect(isLatestLogForMenu(logs, "squat", "2026-09-14")).toBe(true);
  });

  it("ログが無ければ true", () => {
    expect(isLatestLogForMenu([], "bench", "2026-09-16")).toBe(true);
  });
});
