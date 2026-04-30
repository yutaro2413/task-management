import { describe, it, expect } from "vitest";
import { normalizeUrl, makeSelectionExternalId } from "./clipper";

describe("normalizeUrl", () => {
  it("同じ URL は同じ結果", () => {
    expect(normalizeUrl("https://example.com/article")).toBe("https://example.com/article");
  });

  it("hash を除去", () => {
    expect(normalizeUrl("https://example.com/article#section-2")).toBe("https://example.com/article");
  });

  it("utm_* tracking params を除去", () => {
    const r = normalizeUrl("https://example.com/article?utm_source=twitter&utm_medium=social&id=42");
    expect(r).toBe("https://example.com/article?id=42");
  });

  it("fbclid / gclid を除去", () => {
    const r = normalizeUrl("https://example.com/article?fbclid=ABC&gclid=XYZ&id=42");
    expect(r).toBe("https://example.com/article?id=42");
  });

  it("末尾スラッシュは保持 (別記事の可能性があるため)", () => {
    expect(normalizeUrl("https://example.com/article/")).toBe("https://example.com/article/");
    expect(normalizeUrl("https://example.com/article")).toBe("https://example.com/article");
  });

  it("パース不能な文字列はそのまま", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
  });
});

describe("makeSelectionExternalId", () => {
  it("同じテキストは同じ ID を返す (冪等)", () => {
    const a = makeSelectionExternalId("これは選択したテキストです。");
    const b = makeSelectionExternalId("これは選択したテキストです。");
    expect(a).toBe(b);
  });

  it("空白の差を吸収する (タブ・改行・スペース)", () => {
    const a = makeSelectionExternalId("これは\n選択したテキスト\tです。");
    const b = makeSelectionExternalId("これは 選択したテキスト です。");
    expect(a).toBe(b);
  });

  it("内容が異なれば違う ID", () => {
    const a = makeSelectionExternalId("テキスト A");
    const b = makeSelectionExternalId("テキスト B");
    expect(a).not.toBe(b);
  });

  it("先頭 400 文字が同じでも長さが違えば別 ID", () => {
    const head = "x".repeat(400);
    const a = makeSelectionExternalId(head);
    const b = makeSelectionExternalId(head + " extra");
    expect(a).not.toBe(b);
  });

  it("ID 形式は sel-<length>-<hex>", () => {
    const id = makeSelectionExternalId("hello");
    expect(id).toMatch(/^sel-\d+-[0-9a-f]{8}$/);
  });
});
