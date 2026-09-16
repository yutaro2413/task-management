// 旧スキーマ (ExerciseMenu.weights) 用のヘルパー。
// 重量は WorkoutLog から導出する方式へ移行したため、残っているのは移行 API だけが使う。
// weights / defaultWeight カラムを削除する次PRで、このファイルごと削除予定。
// 現行のプリフィルロジックは @/lib/workoutPrefill を参照。

export type MenuWeight = { locationId: string; weight: string };

/** weights 配列を正規化 (locationId 重複排除・不正な要素を除外) */
export function normalizeWeights(input: unknown): MenuWeight[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: MenuWeight[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const locationId = (item as { locationId?: unknown }).locationId;
    const weight = (item as { weight?: unknown }).weight;
    if (typeof locationId !== "string" || locationId === "") continue;
    if (typeof weight !== "string") continue;
    if (seen.has(locationId)) continue;
    seen.add(locationId);
    out.push({ locationId, weight });
  }
  return out;
}
