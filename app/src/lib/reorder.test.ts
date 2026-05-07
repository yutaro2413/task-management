import { describe, it, expect } from "vitest";
import { moveItem } from "./reorder";

describe("moveItem", () => {
  it("中間の要素を上に移動", () => {
    expect(moveItem(["a", "b", "c", "d"], 2, -1)).toEqual(["a", "c", "b", "d"]);
  });
  it("中間の要素を下に移動", () => {
    expect(moveItem(["a", "b", "c", "d"], 1, 1)).toEqual(["a", "c", "b", "d"]);
  });
  it("先頭をさらに上に動かそうとしても変化なし", () => {
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });
  it("末尾をさらに下に動かそうとしても変化なし", () => {
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
  it("空配列でも安全", () => {
    expect(moveItem([], 0, 1)).toEqual([]);
  });
  it("不正な index でも変更なしの新配列を返す", () => {
    expect(moveItem(["a", "b"], -1, 1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 5, -1)).toEqual(["a", "b"]);
  });
  it("元の配列を変更しない (immutable)", () => {
    const src = ["a", "b", "c"];
    moveItem(src, 0, 1);
    expect(src).toEqual(["a", "b", "c"]);
  });
});
