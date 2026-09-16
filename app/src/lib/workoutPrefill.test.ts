import { describe, it, expect } from "vitest";
import {
  logDateKey,
  deriveLatestByMenu,
  pickLatest,
  resolveExercisePrefill,
  isMenuAvailableAt,
  normalizeLocationIds,
  NO_LOCATION,
} from "./workoutPrefill";

const bench = { id: "bench", defaultReps: 10, defaultSets: 3 };

describe("logDateKey", () => {
  it("ISO 文字列から日付部分を取り出す", () => {
    expect(logDateKey("2026-09-16T00:00:00.000Z")).toBe("2026-09-16");
  });
  it("既に YYYY-MM-DD ならそのまま", () => {
    expect(logDateKey("2026-09-16")).toBe("2026-09-16");
  });
});

describe("deriveLatestByMenu", () => {
  const logs = [
    {
      date: "2026-09-14T00:00:00.000Z",
      locationId: "sesame",
      exercises: [{ menuId: "bench", weight: "40", reps: 10, sets: 3, type: "strength" }],
    },
    {
      date: "2026-09-16T00:00:00.000Z",
      locationId: "sesame",
      exercises: [{ menuId: "bench", weight: "45", reps: 8, sets: 3, type: "strength" }],
    },
  ];

  it("メニュー × 場所ごとの直近の記録を返す", () => {
    expect(deriveLatestByMenu(logs)).toEqual({
      bench: { sesame: { weight: "45", reps: 8, sets: 3, date: "2026-09-16" } },
    });
  });

  it("ログの並び順に依存しない", () => {
    expect(deriveLatestByMenu([...logs].reverse())).toEqual(deriveLatestByMenu(logs));
  });

  it("場所ごとに別々に持つ", () => {
    const mixed = [
      ...logs,
      {
        date: "2026-09-15T00:00:00.000Z",
        locationId: "anytime",
        exercises: [{ menuId: "bench", weight: "60", reps: 10, sets: 3, type: "strength" }],
      },
    ];
    const latest = deriveLatestByMenu(mixed);
    expect(latest.bench.sesame.weight).toBe("45");
    expect(latest.bench.anytime.weight).toBe("60");
  });

  it("同じ日に同じメニューが複数行あれば重い行を採用 (回数/set もその行)", () => {
    const sameDay = [
      {
        date: "2026-09-16",
        locationId: "sesame",
        exercises: [
          { menuId: "bench", weight: "40", reps: 10, sets: 3, type: "strength" },
          { menuId: "bench", weight: "50", reps: 5, sets: 1, type: "strength" },
          { menuId: "bench", weight: "45", reps: 8, sets: 2, type: "strength" },
        ],
      },
    ];
    expect(deriveLatestByMenu(sameDay).bench.sesame).toEqual({
      weight: "50", reps: 5, sets: 1, date: "2026-09-16",
    });
  });

  it("before より前の記録だけを見る", () => {
    expect(deriveLatestByMenu(logs, "2026-09-16").bench.sesame.weight).toBe("40");
    expect(deriveLatestByMenu(logs, "2026-09-14")).toEqual({});
  });

  it("場所なしの記録は NO_LOCATION キーに入る", () => {
    const noLoc = [
      { date: "2026-09-16", locationId: null, exercises: [{ menuId: "bench", weight: "40", reps: 10, sets: 3, type: "strength" }] },
    ];
    expect(deriveLatestByMenu(noLoc).bench[NO_LOCATION].weight).toBe("40");
  });

  it("menuId 無し・ランニングは無視する", () => {
    const noisy = [
      {
        date: "2026-09-16",
        locationId: "sesame",
        exercises: [
          { weight: "99", reps: 1, sets: 1, type: "strength" },
          { menuId: "run", weight: "", reps: 0, sets: 0, type: "running" },
        ],
      },
    ];
    expect(deriveLatestByMenu(noisy)).toEqual({});
  });
});

describe("pickLatest", () => {
  const latest = {
    bench: {
      sesame: { weight: "45", reps: 8, sets: 3, date: "2026-09-16" },
      [NO_LOCATION]: { weight: "30", reps: 10, sets: 3, date: "2026-01-01" },
    },
    squat: { sesame: { weight: "80", reps: 5, sets: 5, date: "2026-09-16" } },
  };

  it("指定場所の記録を返す", () => {
    expect(pickLatest(latest, "bench", "sesame")?.weight).toBe("45");
  });

  it("その場所の記録が無ければ場所なしの記録にフォールバック", () => {
    expect(pickLatest(latest, "bench", "anytime")?.weight).toBe("30");
  });

  it("フォールバック先も無ければ null", () => {
    expect(pickLatest(latest, "squat", "anytime")).toBeNull();
    expect(pickLatest(latest, "unknown", "sesame")).toBeNull();
  });

  it("場所未指定なら場所なしの記録", () => {
    expect(pickLatest(latest, "bench", null)?.weight).toBe("30");
  });
});

describe("resolveExercisePrefill", () => {
  const latest = {
    bench: { sesame: { weight: "45", reps: 8, sets: 3, date: "2026-09-16" } },
  };

  it("直近の記録から重量・回数・set を引き継ぐ", () => {
    expect(resolveExercisePrefill(bench, "sesame", latest)).toEqual({ weight: "45", reps: 8, sets: 3 });
  });

  it("記録がまだ無い種目はマスタの既定回数/set・重量は空", () => {
    expect(resolveExercisePrefill(bench, "sesame", {})).toEqual({ weight: "", reps: 10, sets: 3 });
  });

  it("入力中の同じメニューの行を最優先 (2セット目の追加)", () => {
    const current = [{ menuId: "bench", weight: "50", reps: 6, sets: 1, type: "strength" }];
    expect(resolveExercisePrefill(bench, "sesame", latest, current)).toEqual({ weight: "50", reps: 6, sets: 1 });
  });

  it("同じメニューが複数行あれば最後の行を引き継ぐ", () => {
    const current = [
      { menuId: "bench", weight: "45", reps: 8, sets: 2, type: "strength" },
      { menuId: "bench", weight: "50", reps: 6, sets: 1, type: "strength" },
    ];
    expect(resolveExercisePrefill(bench, "sesame", latest, current)).toEqual({ weight: "50", reps: 6, sets: 1 });
  });

  it("別メニューの行は引き継がない", () => {
    const current = [{ menuId: "squat", weight: "80", reps: 5, sets: 5, type: "strength" }];
    expect(resolveExercisePrefill(bench, "sesame", latest, current)).toEqual({ weight: "45", reps: 8, sets: 3 });
  });

  it("入力中の重量が空なら直近の記録に戻す (回数/set は行の値)", () => {
    const current = [{ menuId: "bench", weight: "  ", reps: 6, sets: 1, type: "strength" }];
    expect(resolveExercisePrefill(bench, "sesame", latest, current)).toEqual({ weight: "45", reps: 6, sets: 1 });
  });

  it("別の場所を選ぶとその場所の記録になる (無ければ空)", () => {
    expect(resolveExercisePrefill(bench, "anytime", latest)).toEqual({ weight: "", reps: 10, sets: 3 });
  });
});

describe("isMenuAvailableAt", () => {
  it("locationIds に含まれる場所なら true", () => {
    expect(isMenuAvailableAt({ locationIds: ["sesame"] }, "sesame")).toBe(true);
  });

  it("含まれない場所なら false", () => {
    expect(isMenuAvailableAt({ locationIds: ["sesame"] }, "anytime")).toBe(false);
  });

  it("locationIds が空/未設定なら場所を限定しない", () => {
    expect(isMenuAvailableAt({ locationIds: [] }, "anytime")).toBe(true);
    expect(isMenuAvailableAt({}, "anytime")).toBe(true);
    expect(isMenuAvailableAt({ locationIds: null }, "anytime")).toBe(true);
  });

  it("ランニングと場所未選択は常に true", () => {
    expect(isMenuAvailableAt({ type: "running", locationIds: ["sesame"] }, "anytime")).toBe(true);
    expect(isMenuAvailableAt({ locationIds: ["sesame"] }, null)).toBe(true);
  });
});

describe("normalizeLocationIds", () => {
  it("重複と空文字を除外する", () => {
    expect(normalizeLocationIds(["a", "a", "", "b"])).toEqual(["a", "b"]);
  });
  it("文字列以外を除外する", () => {
    expect(normalizeLocationIds(["a", 1, null, { id: "b" }])).toEqual(["a"]);
  });
  it("配列以外は空配列", () => {
    expect(normalizeLocationIds(null)).toEqual([]);
    expect(normalizeLocationIds("a")).toEqual([]);
  });
});
