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
