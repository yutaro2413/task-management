// 配列の指定インデックスの要素を 1 つ上 (-1) または下 (+1) に移動した新配列を返す純粋関数。
// 端を超える移動 (先頭 -1 / 末尾 +1) は変更なしの同じ参照を返す。

export function moveItem<T>(arr: readonly T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (index < 0 || index >= arr.length) return arr.slice();
  if (target < 0 || target >= arr.length) return arr.slice();
  const next = arr.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
