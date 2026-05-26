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
