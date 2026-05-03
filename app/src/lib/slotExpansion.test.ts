import { describe, it, expect } from "vitest";
import { addDaysIso, expandEntrySlots, filterSlotsInRange } from "./slotExpansion";

describe("addDaysIso", () => {
  it("通常日加算", () => {
    expect(addDaysIso("2026-05-04", 1)).toBe("2026-05-05");
    expect(addDaysIso("2026-05-04", 7)).toBe("2026-05-11");
  });
  it("月跨ぎ", () => {
    expect(addDaysIso("2026-05-31", 1)).toBe("2026-06-01");
  });
  it("年跨ぎ", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("負の値", () => {
    expect(addDaysIso("2026-05-04", -1)).toBe("2026-05-03");
  });
});

describe("expandEntrySlots", () => {
  it("通常エントリ (深夜跨ぎなし) は同日のスロットを返す", () => {
    // 5/4 09:00-10:00 = startSlot 18, endSlot 20 (2 スロット)
    const r = expandEntrySlots("2026-05-04", 18, 20);
    expect(r).toEqual([
      { date: "2026-05-04", slot: 18 },
      { date: "2026-05-04", slot: 19 },
    ]);
  });

  it("日跨ぎエントリ (5/3 23:30 → 翌 02:30) は両日に分配される", () => {
    // startSlot 47 (23:30), endSlot 53 (= 翌 02:30)
    const r = expandEntrySlots("2026-05-03", 47, 53);
    expect(r).toEqual([
      { date: "2026-05-03", slot: 47 },
      { date: "2026-05-04", slot: 0 },
      { date: "2026-05-04", slot: 1 },
      { date: "2026-05-04", slot: 2 },
      { date: "2026-05-04", slot: 3 },
      { date: "2026-05-04", slot: 4 },
    ]);
  });

  it("startSlot >= 48 の異常ケースでも翌日として扱う", () => {
    // startSlot 48 = 翌 00:00
    const r = expandEntrySlots("2026-05-03", 48, 50);
    expect(r).toEqual([
      { date: "2026-05-04", slot: 0 },
      { date: "2026-05-04", slot: 1 },
    ]);
  });

  it("空 (start == end) は空配列", () => {
    expect(expandEntrySlots("2026-05-04", 5, 5)).toEqual([]);
  });
});

describe("filterSlotsInRange", () => {
  it("範囲内のみ残す", () => {
    const refs = [
      { date: "2026-05-03", slot: 47 },
      { date: "2026-05-04", slot: 0 },
      { date: "2026-05-04", slot: 1 },
      { date: "2026-05-11", slot: 0 },
    ];
    const r = filterSlotsInRange(refs, "2026-05-04", "2026-05-10");
    expect(r).toEqual([
      { date: "2026-05-04", slot: 0 },
      { date: "2026-05-04", slot: 1 },
    ]);
  });

  it("空入力は空", () => {
    expect(filterSlotsInRange([], "2026-05-04", "2026-05-10")).toEqual([]);
  });

  it("範囲端は包含 (inclusive)", () => {
    const refs = [
      { date: "2026-05-04", slot: 0 },
      { date: "2026-05-10", slot: 0 },
    ];
    const r = filterSlotsInRange(refs, "2026-05-04", "2026-05-10");
    expect(r.length).toBe(2);
  });
});

describe("週次サマリ用シナリオ統合", () => {
  it("villa バグの再現: 5/3 stored 47..53 → 5/4-5/10 の週で 5 スロット (slots 48-52 の visual 0-4) が拾われる", () => {
    const expanded = expandEntrySlots("2026-05-03", 47, 53);
    const inWeek = filterSlotsInRange(expanded, "2026-05-04", "2026-05-10");
    // 5/3 の slot 47 は範囲外、5/4 の slot 0..4 (5 個) が残る
    expect(inWeek.length).toBe(5);
    expect(inWeek.every((r) => r.date === "2026-05-04")).toBe(true);
    expect(inWeek.map((r) => r.slot)).toEqual([0, 1, 2, 3, 4]);
  });
});
