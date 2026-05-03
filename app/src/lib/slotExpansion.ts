// 日跨ぎエントリを「実際の日」の「実際のスロット (0-47)」に分解するヘルパー。
//
// アプリでは「23:30 から翌 2:30 まで作業した」エントリを、
//   date = 開始日 (例: 5/3)
//   startSlot = 47 (23:30)
//   endSlot   = 53 (翌 2:30 = 48 + 5)
// として保存する慣習。タイムライン表示時は前日のエントリで endSlot >= 48 のものを
// 翌日の 0:00- として描画している (TimelinePage.tsx)。
//
// 週次サマリ等の集計では、このエントリの slots 47 は 5/3、slots 48-52 は 5/4 として
// 扱う必要がある。本ヘルパーはこれをスロット単位で展開する。

export type SlotRef = {
  /** YYYY-MM-DD */
  date: string;
  /** 0..47 */
  slot: number;
};

/** YYYY-MM-DD から n 日後の YYYY-MM-DD を返す (UTC ベースで安全に計算) */
export function addDaysIso(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * エントリ 1 つを、実際に占有する (date, slot) のリストに展開する。
 * slot >= 48 は翌日にズラす (slot 48 → 翌日 0、slot 49 → 翌日 1、…)。
 * slot >= 96 (= 翌々日) も同様に処理。理論上 48*N まで。
 */
export function expandEntrySlots(
  startDate: string,
  startSlot: number,
  endSlot: number,
): SlotRef[] {
  const refs: SlotRef[] = [];
  for (let s = startSlot; s < endSlot; s++) {
    const dayOffset = Math.floor(s / 48);
    const localSlot = s - dayOffset * 48;
    refs.push({
      date: dayOffset === 0 ? startDate : addDaysIso(startDate, dayOffset),
      slot: localSlot,
    });
  }
  return refs;
}

/**
 * 範囲 [rangeStart, rangeEnd] (inclusive) に含まれるスロット参照だけ残す。
 * 週次サマリで前日エントリを fetch したときに、前日の通常スロット (0-47) を
 * 切り捨てるのに使う。
 */
export function filterSlotsInRange(
  refs: SlotRef[],
  rangeStart: string,
  rangeEnd: string,
): SlotRef[] {
  return refs.filter((r) => r.date >= rangeStart && r.date <= rangeEnd);
}
