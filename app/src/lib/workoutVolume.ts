// 筋トレログの数値計算ヘルパー。HobbyPage と単体テストで共有する。

const CIRCLED_NUMBERS: Record<string, number> = {
  "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5,
  "⑥": 6, "⑦": 7, "⑧": 8, "⑨": 9, "⑩": 10,
  "⑪": 11, "⑫": 12, "⑬": 13, "⑭": 14, "⑮": 15,
  "⑯": 16, "⑰": 17, "⑱": 18, "⑲": 19, "⑳": 20,
};

/**
 * 重量フィールドを数値に変換。 "10kg" / "20" / "③" / "5番" 等を吸収。
 * パース不能・空文字は null。
 */
export function parseWeight(w: string): number | null {
  if (!w || !w.trim()) return null;
  const trimmed = w.trim();
  if (CIRCLED_NUMBERS[trimmed] !== undefined) return CIRCLED_NUMBERS[trimmed];
  const num = parseFloat(trimmed.replace(/[kgKG㎏番]/g, ""));
  return isNaN(num) ? null : num;
}

export type StrengthExerciseLike = {
  weight: string;
  reps: number;
  sets: number;
  type: string;
};

/**
 * 1 種目あたりの「ボリューム」 (Training Volume) を計算する。
 *   ボリューム = 重量 × 回数 × セット数
 *
 * type === "running" や、重量が parse できない場合は null を返す。
 */
export function exerciseVolume(ex: StrengthExerciseLike): number | null {
  if (ex.type === "running") return null;
  const w = parseWeight(ex.weight);
  if (w === null) return null;
  const reps = Number.isFinite(ex.reps) && ex.reps > 0 ? ex.reps : 0;
  const sets = Number.isFinite(ex.sets) && ex.sets > 0 ? ex.sets : 0;
  if (reps === 0 || sets === 0) return null;
  return w * reps * sets;
}
