// Kindle 同期で「来なかった既存項目を archive、戻ってきた archived 項目を復活」を計算する純粋関数。
//
// 想定:
//   incoming    = 今回の同期で取得した externalId の集合
//   existing    = DB に既にある externalId とその archived 状態
// 出力:
//   toArchive   = まだ active だが今回 incoming に無い externalId
//   toRestore   = archived だが今回 incoming に存在する externalId
//   newOnes     = incoming に在って existing に無い externalId
// 何度実行しても結果が変わらない (冪等)。

export type ExistingRecord = {
  externalId: string;
  archived: boolean;
};

export type SyncDiff = {
  toArchive: string[];
  toRestore: string[];
  newOnes: string[];
};

export function computeSyncDiff(
  incoming: string[],
  existing: ExistingRecord[],
): SyncDiff {
  const incomingSet = new Set(incoming);
  const existingMap = new Map(existing.map((e) => [e.externalId, e.archived]));

  const toArchive: string[] = [];
  const toRestore: string[] = [];
  for (const [extId, archived] of existingMap) {
    const inIncoming = incomingSet.has(extId);
    if (inIncoming && archived) toRestore.push(extId);
    else if (!inIncoming && !archived) toArchive.push(extId);
  }

  const newOnes: string[] = [];
  for (const extId of incoming) {
    if (!existingMap.has(extId)) newOnes.push(extId);
  }

  return { toArchive, toRestore, newOnes };
}
