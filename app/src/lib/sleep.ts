// Sleep session estimation from raw unlock-event timestamps.
// JST (+09:00) is the assumed display timezone for date assignment.

export const MIN_SLEEP_GAP_HOURS = 4;
export const MAX_SLEEP_GAP_HOURS = 16;
const HOUR_MS = 60 * 60 * 1000;

// JST 時刻範囲フィルタ: 日中の長時間ギャップ（会議・運転等）を睡眠と誤判定しないため
// 就寝時刻 (gap 開始) は JST 20:00〜翌5:59 のみ採用
// 起床時刻 (gap 終了) は JST 4:00〜11:59 のみ採用
const SLEEP_HOUR_RANGE = (h: number) => h >= 20 || h < 6;
const WAKE_HOUR_RANGE = (h: number) => h >= 4 && h < 12;

export type SleepSession = {
  date: string; // YYYY-MM-DD (JST date of wake)
  sleepAt: string; // ISO
  wakeAt: string; // ISO
  durationMinutes: number;
};

function jstDateKey(d: Date): string {
  const jst = new Date(d.getTime() + 9 * HOUR_MS);
  return jst.toISOString().split("T")[0];
}

function jstHour(d: Date): number {
  return new Date(d.getTime() + 9 * HOUR_MS).getUTCHours();
}

/**
 * Detects sleep sessions from a series of unlock events by finding gaps of
 * MIN_SLEEP_GAP_HOURS〜MAX_SLEEP_GAP_HOURS between consecutive timestamps,
 * additionally constrained by JST sleep/wake hour ranges to avoid daytime
 * false positives. Each detected gap is assigned to the JST date of its wake
 * (gap.end) timestamp. If multiple candidate gaps end on the same JST date,
 * the longest one wins.
 */
export function computeSleepSessions(
  events: { timestamp: Date | string }[]
): SleepSession[] {
  const sorted = events
    .map((e) => (e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp)))
    .sort((a, b) => a.getTime() - b.getTime());

  const byDate = new Map<string, SleepSession>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const gapMs = next.getTime() - prev.getTime();
    const gapHours = gapMs / HOUR_MS;
    if (gapHours < MIN_SLEEP_GAP_HOURS || gapHours > MAX_SLEEP_GAP_HOURS) continue;
    if (!SLEEP_HOUR_RANGE(jstHour(prev))) continue;
    if (!WAKE_HOUR_RANGE(jstHour(next))) continue;

    const date = jstDateKey(next);
    const candidate: SleepSession = {
      date,
      sleepAt: prev.toISOString(),
      wakeAt: next.toISOString(),
      durationMinutes: Math.round(gapMs / 60000),
    };
    const existing = byDate.get(date);
    if (!existing || candidate.durationMinutes > existing.durationMinutes) {
      byDate.set(date, candidate);
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 睡眠セッションの HH:MM 編集時に、相棒タイムスタンプ (anchorIso) から見て
 * 妥当な duration になる日付を推定して ISO を返す。
 *
 * 例: wakeAt = 5/19 09:24, ユーザーが sleepAt を「01:21」に編集 →
 *   候補 [5/18 01:21 (dur=32h), 5/19 01:21 (dur=8h), 5/20 01:21 (dur=-16h)]
 *   → 5/19 01:21 を選択 (dur が 0 < d < 20h で 7h に最も近い)
 *
 * @param hhmm        ユーザー入力 "HH:MM"
 * @param anchorIso   相棒の ISO (sleepAt 編集なら wakeAt、wakeAt 編集なら sleepAt)
 * @param fieldKind   編集中のフィールド種別
 * @returns ISO 文字列
 */
export function smartReplaceSleepTime(
  hhmm: string,
  anchorIso: string,
  fieldKind: "sleep" | "wake",
): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return anchorIso;
  const anchor = new Date(anchorIso);
  // anchor の JST 日付を基準に ±1 日の候補を作る
  const anchorJst = new Date(anchor.getTime() + 9 * HOUR_MS);
  const y = anchorJst.getUTCFullYear();
  const mo = anchorJst.getUTCMonth();
  const d = anchorJst.getUTCDate();

  const candidates = [-1, 0, 1].map((offset) =>
    Date.UTC(y, mo, d + offset, hh, mm, 0, 0) - 9 * HOUR_MS,
  );

  const TARGET_MS = 7 * HOUR_MS; // 7 時間に最も近いものを優先
  const MAX_VALID_MS = 20 * HOUR_MS;
  const anchorMs = anchor.getTime();

  let best = candidates[1]; // デフォルト: anchor と同日
  let bestScore = Infinity;
  for (const c of candidates) {
    const sleepMs = fieldKind === "sleep" ? c : anchorMs;
    const wakeMs = fieldKind === "wake" ? c : anchorMs;
    const dur = wakeMs - sleepMs;
    let score: number;
    if (dur <= 0) {
      score = 1e12 + Math.abs(dur);                // 負の duration は強くペナルティ
    } else if (dur > MAX_VALID_MS) {
      score = 1e9 + dur;                            // 20h 超もペナルティ
    } else {
      score = Math.abs(dur - TARGET_MS);            // 7h に近いほど良い
    }
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return new Date(best).toISOString();
}
