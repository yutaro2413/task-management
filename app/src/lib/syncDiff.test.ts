import { describe, it, expect } from "vitest";
import { computeSyncDiff } from "./syncDiff";

describe("computeSyncDiff", () => {
  it("incoming だけにある項目は newOnes", () => {
    const r = computeSyncDiff(["A", "B"], []);
    expect(r.newOnes.sort()).toEqual(["A", "B"]);
    expect(r.toArchive).toEqual([]);
    expect(r.toRestore).toEqual([]);
  });

  it("既存に在って incoming に無い active 項目は toArchive", () => {
    const r = computeSyncDiff(["A"], [
      { externalId: "A", archived: false },
      { externalId: "B", archived: false },
    ]);
    expect(r.toArchive).toEqual(["B"]);
    expect(r.toRestore).toEqual([]);
    expect(r.newOnes).toEqual([]);
  });

  it("archived な項目が incoming に戻ったら toRestore", () => {
    const r = computeSyncDiff(["A", "B"], [
      { externalId: "A", archived: false },
      { externalId: "B", archived: true },
    ]);
    expect(r.toRestore).toEqual(["B"]);
    expect(r.toArchive).toEqual([]);
    expect(r.newOnes).toEqual([]);
  });

  it("archived のままで incoming にも無い項目は何もしない", () => {
    const r = computeSyncDiff(["A"], [
      { externalId: "A", archived: false },
      { externalId: "B", archived: true },
    ]);
    expect(r.toArchive).toEqual([]);
    expect(r.toRestore).toEqual([]);
    expect(r.newOnes).toEqual([]);
  });

  it("複合: 新規 + アーカイブ + 復活 + 変化なしが混在", () => {
    const r = computeSyncDiff(["A", "C", "D"], [
      { externalId: "A", archived: false }, // 維持
      { externalId: "B", archived: false }, // → archive
      { externalId: "C", archived: true },  // → restore
    ]);
    expect(r.toArchive).toEqual(["B"]);
    expect(r.toRestore).toEqual(["C"]);
    expect(r.newOnes).toEqual(["D"]);
  });

  it("incoming が空: 全 active 項目を archive", () => {
    const r = computeSyncDiff([], [
      { externalId: "A", archived: false },
      { externalId: "B", archived: false },
      { externalId: "C", archived: true },
    ]);
    expect(r.toArchive.sort()).toEqual(["A", "B"]);
    expect(r.toRestore).toEqual([]);
    expect(r.newOnes).toEqual([]);
  });

  it("冪等: 同じ入力で 2 回呼んでも結果は同じ", () => {
    const incoming = ["A", "C"];
    const existing = [
      { externalId: "A", archived: false },
      { externalId: "B", archived: false },
      { externalId: "C", archived: true },
    ];
    const r1 = computeSyncDiff(incoming, existing);
    const r2 = computeSyncDiff(incoming, existing);
    expect(r1).toEqual(r2);
  });
});
