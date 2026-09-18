// 筋トレメニューの場所別重量を解決する純粋関数。

export type MenuWeight = { locationId: string; weight: string };

export type MenuLike = {
  defaultWeight: string;
  weights?: MenuWeight[] | null;
};

/**
 * 指定された場所 (locationId) の重量を返す。
 * 場所別の設定が無ければ defaultWeight にフォールバック。
 * locationId が null/未指定なら defaultWeight。
 */
export function resolveMenuWeight(menu: MenuLike, locationId: string | null | undefined): string {
  if (locationId && Array.isArray(menu.weights)) {
    const found = menu.weights.find((w) => w.locationId === locationId);
    if (found && found.weight !== "") return found.weight;
  }
  return menu.defaultWeight ?? "";
}

export type MenuPrefillSource = MenuLike & {
  id: string;
  defaultReps: number;
  defaultSets: number;
};

export type ExerciseLike = {
  menuId?: string;
  weight: string;
  reps: number;
  sets: number;
  type?: string;
};

/**
 * メニューを記録に追加する時のプリフィル値。
 * 同じメニューが既に入力中なら「その行に今入っている値」を優先する。
 * (2 セット目を足した時に、さっき上げた重量がそのまま入るように)
 * 入力中の行が無ければマスタ (場所別重量 → defaultWeight) から解決する。
 */
export function resolveExercisePrefill(
  menu: MenuPrefillSource,
  locationId: string | null | undefined,
  current: ExerciseLike[] = [],
): { weight: string; reps: number; sets: number } {
  const sameMenu = current.filter((e) => e.menuId === menu.id && e.type !== "running");
  const last = sameMenu[sameMenu.length - 1];
  const masterWeight = resolveMenuWeight(menu, locationId);
  if (!last) {
    return { weight: masterWeight, reps: menu.defaultReps, sets: menu.defaultSets };
  }
  return {
    // 入力中の行が空なら (消しただけ) マスタに戻す
    weight: last.weight.trim() !== "" ? last.weight : masterWeight,
    reps: last.reps,
    sets: last.sets,
  };
}

/**
 * 前回の記録を引き継ぐ時に、選択中の場所のマスタ重量で上書きする。
 * マスタ側が空のメニューは記録の値をそのまま残す。
 */
export function applyMasterWeights<T extends ExerciseLike>(
  exercises: T[],
  menus: MenuPrefillSource[],
  locationId: string | null | undefined,
): T[] {
  return exercises.map((ex) => {
    if (!ex.menuId || ex.type === "running") return ex;
    const menu = menus.find((m) => m.id === ex.menuId);
    if (!menu) return ex;
    const weight = resolveMenuWeight(menu, locationId);
    if (weight.trim() === "" || weight === ex.weight) return ex;
    return { ...ex, weight };
  });
}

/** WorkoutLog.date (ISO 文字列 or "YYYY-MM-DD") を "YYYY-MM-DD" に正規化 */
export function logDateKey(date: string): string {
  return date.includes("T") ? date.split("T")[0] : date;
}

export type WorkoutLogLike = { date: string; exercises: { menuId?: string }[] };

/**
 * targetDate のログが、そのメニューを含む最新のログかどうか。
 * 過去ログを直した時にマスタの重量を古い値で巻き戻さないためのガード。
 */
export function isLatestLogForMenu(
  logs: WorkoutLogLike[],
  menuId: string,
  targetDate: string,
): boolean {
  return !logs.some(
    (log) =>
      logDateKey(log.date) > targetDate &&
      log.exercises.some((e) => e.menuId === menuId),
  );
}

/** weights 配列を正規化 (locationId 重複排除・空 weight 除外) */
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
