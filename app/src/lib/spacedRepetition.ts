// SM-2 spaced repetition の簡易版実装。
//
// オリジナル SM-2 (Anki も同系統) の "quality" は 0-5 だが、
// UI の認知負荷を下げるため 4 段階に集約:
//   0 = Forgot (覚えていなかった)  → リセットして 1 日後
//   1 = Hard   (思い出すのが大変)  → 短い間隔
//   2 = Good   (普通に思い出せた)  → 通常進行
//   3 = Easy   (即答)              → 通常進行 + ボーナス
//
// 出力:
//   nextInterval (日数), nextEase, nextReps, nextReviewAt (Date)

export type Rating = 0 | 1 | 2 | 3;

export type ReviewState = {
  interval: number; // 直前の interval (日)
  ease: number;     // ease factor (1.3 ~ 2.5+)
  reps: number;     // 連続成功回数
};

export type ReviewResult = ReviewState & {
  nextReviewAt: Date;
};

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCHours(0, 0, 0, 0); // JST 日跨ぎを意識しない素朴な日付丸め
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function scheduleNext(
  state: ReviewState,
  rating: Rating,
  now: Date = new Date(),
): ReviewResult {
  const ease = Number.isFinite(state.ease) && state.ease > 0 ? state.ease : DEFAULT_EASE;

  // Forgot → 1 日後にリセット
  if (rating === 0) {
    const nextEase = Math.max(MIN_EASE, ease - 0.2);
    return {
      interval: 1,
      ease: nextEase,
      reps: 0,
      nextReviewAt: addDays(now, 1),
    };
  }

  // Hard / Good / Easy: ease 調整
  // SM-2 の調整値を 4 段階に簡略化
  const easeDelta = rating === 1 ? -0.15 : rating === 2 ? 0 : 0.15;
  const nextEase = Math.max(MIN_EASE, ease + easeDelta);

  const nextReps = state.reps + 1;
  let nextInterval: number;
  if (nextReps === 1) {
    nextInterval = rating === 1 ? 1 : rating === 3 ? 3 : 2; // 初回: Hard=1日, Good=2日, Easy=3日
  } else if (nextReps === 2) {
    nextInterval = rating === 1 ? 3 : rating === 3 ? 7 : 5;
  } else {
    // 通常進行: 直前 interval × ease、Easy はさらに 1.3 倍、Hard は 1.2 倍に抑制
    const base = Math.max(state.interval, 1) * nextEase;
    const multiplier = rating === 1 ? 1.2 / nextEase : rating === 3 ? 1.3 : 1;
    nextInterval = Math.round(base * multiplier);
  }

  // 過剰に長いスケジュールを防ぐ上限 (1 年)
  if (nextInterval > 365) nextInterval = 365;

  return {
    interval: nextInterval,
    ease: nextEase,
    reps: nextReps,
    nextReviewAt: addDays(now, nextInterval),
  };
}

// 新規ハイライトの初期スケジュール (DB の reviewInterval=0, reviewReps=0 から始める想定)
export const INITIAL_STATE: ReviewState = {
  interval: 0,
  ease: DEFAULT_EASE,
  reps: 0,
};
