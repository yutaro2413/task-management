// ジム通いカウント。WorkoutLog (date @unique) 1 件を「1 日行った」と数える。
//
// 仕様:
//   - START_DATE (2026-04-19) 以降の WorkoutLog 件数を「総回数」として数える
//   - 経過日数を 7 / 30.4375 で割って週平均・月平均を出す
//     → 部分期間 (例: 開始から 12 日) は自動で月割換算される
//       (4/19-4/30 で 5 回行ったら月平均 = 5 / (12/30.4375) ≈ 12.7 回/月)

export const GYM_START_DATE = "2026-04-19";

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH_AVG = 30.4375; // 平均月日数 (グレゴリオ暦)

export type GymStats = {
  /** START_DATE 以降の通った日数 (= WorkoutLog の件数) */
  visits: number;
  /** START_DATE から today までの経過日数 (inclusive) */
  daysElapsed: number;
  weeklyAvg: number;
  monthlyAvg: number;
};

/** "YYYY-MM-DD" または ISO 文字列 から YYYY-MM-DD 部分を取り出す */
export function toDateKey(input: string): string {
  return input.includes("T") ? input.split("T")[0] : input;
}

export function calcGymStats(
  workoutDates: string[],
  now: Date = new Date(),
  startDateStr: string = GYM_START_DATE,
): GymStats {
  const start = new Date(startDateStr + "T00:00:00Z");
  // today は JST 想定だが、UTC ベースで日数を計算 (1 日 = 86400s で divide できればよい)
  const todayStr = now.toISOString().slice(0, 10);
  const today = new Date(todayStr + "T00:00:00Z");

  // start より前なら 0 件、経過 0 日。期間外を避けるため Math.max(1, ...) で 1 日以上にする。
  const daysElapsedRaw = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  const daysElapsed = Math.max(1, daysElapsedRaw);

  // 通った日数: 入力配列をユニーク化し、開始日以降に絞る
  const uniqueDates = new Set(workoutDates.map(toDateKey));
  let visits = 0;
  for (const d of uniqueDates) {
    if (d >= startDateStr && d <= todayStr) visits++;
  }

  const weeklyAvg = visits / (daysElapsed / 7);
  const monthlyAvg = visits / (daysElapsed / DAYS_PER_MONTH_AVG);

  return {
    visits,
    daysElapsed,
    weeklyAvg,
    monthlyAvg,
  };
}

/** 数値を小数 1 桁に整形 (1.0 のような末尾 .0 は保持) */
export function fmtAvg(n: number): string {
  return n.toFixed(1);
}
