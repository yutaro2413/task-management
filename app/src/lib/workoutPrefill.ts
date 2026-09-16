// 筋トレの「次に入力する値」を記録 (WorkoutLog) から導出する純粋関数群。
//
// 設計方針: 重量の真実の源は記録 1 つだけ。
// ExerciseMenu (マスタ) は「何をやるか」だけを持ち、重量は持たない。
// 「次回のプリフィル = その場所での直近の記録」として毎回導出するので、
// 記録とマスタを双方向に同期する必要がなくなる。

/** 場所なしで記録されたログをまとめるキー */
export const NO_LOCATION = "";

export type LatestEntry = {
  weight: string;
  reps: number;
  sets: number;
  /** 由来した記録の日付 ("YYYY-MM-DD") */
  date: string;
};

/** { menuId: { locationId: 直近の記録 } } */
export type LatestByMenu = Record<string, Record<string, LatestEntry>>;

export type LogExerciseLike = {
  menuId?: string;
  weight: string;
  reps: number;
  sets: number;
  type?: string;
};

export type WorkoutLogLike = {
  date: string;
  locationId?: string | null;
  exercises: LogExerciseLike[];
};

/** WorkoutLog.date (ISO 文字列 or "YYYY-MM-DD") を "YYYY-MM-DD" に正規化 */
export function logDateKey(date: string): string {
  return date.includes("T") ? date.split("T")[0] : date;
}

/** 数値として重いか (パースできない側は「軽い」扱い) */
function isHeavier(candidate: string, current: string): boolean {
  const next = parseFloat(candidate);
  if (Number.isNaN(next)) return false;
  const cur = parseFloat(current);
  return Number.isNaN(cur) || next > cur;
}

/**
 * ログ群から「メニュー × 場所ごとの直近の記録」を導出する。
 *
 * - 同じ日に同じメニューが複数行あれば、数値として最も重い行を採用する
 *   (回数/set もその行のものを採用)
 * - `before` を渡すとその日「より前」の記録だけを見る (編集中の日を除くため)
 * - logs の並び順には依存しない (日付で比較する)
 */
export function deriveLatestByMenu(
  logs: WorkoutLogLike[],
  before?: string,
): LatestByMenu {
  const out: LatestByMenu = {};
  for (const log of logs) {
    const date = logDateKey(log.date);
    if (before && date >= before) continue;
    const locationKey = log.locationId ?? NO_LOCATION;
    for (const ex of log.exercises) {
      if (!ex.menuId || ex.type === "running") continue;
      const byLocation = (out[ex.menuId] ??= {});
      const cur = byLocation[locationKey];
      // 古い記録には欠けているフィールドがありうるので型を揃えておく
      const next: LatestEntry = {
        weight: typeof ex.weight === "string" ? ex.weight : "",
        reps: typeof ex.reps === "number" ? ex.reps : 0,
        sets: typeof ex.sets === "number" ? ex.sets : 0,
        date,
      };
      if (!cur) {
        byLocation[locationKey] = next;
        continue;
      }
      // より新しい日付が勝つ。同じ日なら重い行が勝つ。
      if (date > cur.date || (date === cur.date && isHeavier(next.weight, cur.weight))) {
        byLocation[locationKey] = next;
      }
    }
  }
  return out;
}

/**
 * 指定メニュー・指定場所の直近記録を引く。
 * その場所の記録が無ければ「場所なしで記録されたログ」にフォールバックする
 * (場所を導入する前の古い記録を拾うため)。
 */
export function pickLatest(
  latest: LatestByMenu,
  menuId: string,
  locationId: string | null | undefined,
): LatestEntry | null {
  const byLocation = latest[menuId];
  if (!byLocation) return null;
  if (locationId) {
    const hit = byLocation[locationId];
    if (hit) return hit;
  }
  return byLocation[NO_LOCATION] ?? null;
}

export type MenuLike = {
  id: string;
  defaultReps: number;
  defaultSets: number;
  type?: string;
};

export type DraftExerciseLike = {
  menuId?: string;
  weight: string;
  reps: number;
  sets: number;
  type?: string;
};

/**
 * メニューを記録に追加する時のプリフィル値。優先順位:
 *   1. 入力中の同じメニューの行 (2 セット目を足した時に、さっき上げた重量が入る)
 *   2. その場所での直近の記録
 *   3. マスタの既定回数/set (重量は空 = 初めてやる種目)
 */
export function resolveExercisePrefill(
  menu: MenuLike,
  locationId: string | null | undefined,
  latest: LatestByMenu,
  current: DraftExerciseLike[] = [],
): { weight: string; reps: number; sets: number } {
  const previous = pickLatest(latest, menu.id, locationId);
  const fallback = {
    weight: previous?.weight ?? "",
    reps: previous?.reps ?? menu.defaultReps,
    sets: previous?.sets ?? menu.defaultSets,
  };

  const sameMenu = current.filter((e) => e.menuId === menu.id && e.type !== "running");
  const last = sameMenu[sameMenu.length - 1];
  if (!last) return fallback;

  return {
    // 入力中の行が空なら (消しただけ) 直近の記録に戻す
    weight: last.weight.trim() !== "" ? last.weight : fallback.weight,
    reps: last.reps,
    sets: last.sets,
  };
}

/**
 * 「選択中の場所でできる種目か」。
 * locationIds が空のメニューは場所を限定していない扱い (= どこでもできる)。
 */
export function isMenuAvailableAt(
  menu: { type?: string; locationIds?: string[] | null },
  locationId: string | null | undefined,
): boolean {
  if (menu.type === "running") return true;
  if (!locationId) return true;
  const ids = menu.locationIds;
  if (!Array.isArray(ids) || ids.length === 0) return true;
  return ids.includes(locationId);
}

/** locationIds を正規化 (文字列のみ・空文字除外・重複排除) */
export function normalizeLocationIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string" || item === "") continue;
    seen.add(item);
  }
  return [...seen];
}
