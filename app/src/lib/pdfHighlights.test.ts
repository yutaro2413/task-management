import { describe, it, expect } from "vitest";
import { mapPdfColor, parsePdfDate, extractHighlightsFromPdf } from "./pdfHighlights";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";

describe("mapPdfColor", () => {
  it("黄色 RGB を yellow にマップ", () => {
    expect(mapPdfColor([1, 1, 0])).toBe("yellow");
  });

  it("青系を blue にマップ", () => {
    expect(mapPdfColor([0.4, 0.6, 1])).toBe("blue");
  });

  it("橙を orange にマップ", () => {
    expect(mapPdfColor([1, 0.6, 0])).toBe("orange");
  });

  it("ピンクを pink にマップ", () => {
    expect(mapPdfColor([1, 0.5, 0.7])).toBe("pink");
  });

  it("中間色も最近傍にマップ", () => {
    expect(mapPdfColor([0.95, 0.95, 0.05])).toBe("yellow");
  });

  it("null/不正は null を返す", () => {
    expect(mapPdfColor(null)).toBeNull();
    expect(mapPdfColor([1, 0])).toBeNull();
    expect(mapPdfColor(undefined)).toBeNull();
  });
});

describe("parsePdfDate", () => {
  it("D:YYYYMMDDHHmmSS+TZ を Date にパース", () => {
    const d = parsePdfDate("D:20260430120000+09'00'");
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("時刻省略形でもパース可能", () => {
    const d = parsePdfDate("D:20260430");
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("不正形式は null", () => {
    expect(parsePdfDate("not a date")).toBeNull();
    expect(parsePdfDate(null)).toBeNull();
    expect(parsePdfDate("")).toBeNull();
  });
});

describe("extractHighlightsFromPdf", () => {
  // 動的に最小限の PDF を作って /Highlight 注釈を付けて検証する
  async function buildPdfWithHighlights(): Promise<ArrayBuffer> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 800]);
    page.drawText("hello world", { x: 50, y: 700 });

    const ctx = pdf.context;

    // /Highlight 注釈 1 (本文有り)
    const annot1 = ctx.obj({
      Type: PDFName.of("Annot"),
      Subtype: PDFName.of("Highlight"),
      Rect: [50, 700, 200, 720],
      Contents: PDFString.of("highlighted phrase one"),
      T: PDFString.of("yutaro"),
      M: PDFString.of("D:20260430120000Z"),
      C: [1, 1, 0],
    });

    // /Highlight 注釈 2 (本文空, 色違い)
    const annot2 = ctx.obj({
      Type: PDFName.of("Annot"),
      Subtype: PDFName.of("Highlight"),
      Rect: [50, 600, 200, 620],
      Contents: PDFString.of(""),
      C: [0.4, 0.6, 1],
    });

    // /Text 注釈 (Highlight 以外は無視されるはず)
    const annot3 = ctx.obj({
      Type: PDFName.of("Annot"),
      Subtype: PDFName.of("Text"),
      Rect: [10, 10, 30, 30],
      Contents: PDFString.of("text annotation should be ignored"),
    });

    page.node.set(PDFName.of("Annots"), ctx.obj([annot1, annot2, annot3]));

    const bytes = await pdf.save();
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  it("Highlight 注釈のみ抽出する (Text 注釈は無視)", async () => {
    const buf = await buildPdfWithHighlights();
    const result = await extractHighlightsFromPdf(buf);
    expect(result.pageCount).toBe(1);
    expect(result.highlights).toHaveLength(2);
  });

  it("/Contents をテキストとして取得", async () => {
    const buf = await buildPdfWithHighlights();
    const result = await extractHighlightsFromPdf(buf);
    expect(result.highlights[0].text).toBe("highlighted phrase one");
  });

  it("作者・色・修正日を取得", async () => {
    const buf = await buildPdfWithHighlights();
    const result = await extractHighlightsFromPdf(buf);
    expect(result.highlights[0].author).toBe("yutaro");
    expect(result.highlights[0].color).toBe("yellow");
    expect(result.highlights[0].modifiedAt?.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("ページ番号は 1-indexed", async () => {
    const buf = await buildPdfWithHighlights();
    const result = await extractHighlightsFromPdf(buf);
    expect(result.highlights.every((h) => h.page === 1)).toBe(true);
  });

  it("/Contents 空でも抽出される (text='')", async () => {
    const buf = await buildPdfWithHighlights();
    const result = await extractHighlightsFromPdf(buf);
    expect(result.highlights[1].text).toBe("");
    expect(result.highlights[1].color).toBe("blue");
  });

  it("注釈が一切無い PDF は空リストを返す", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const result = await extractHighlightsFromPdf(buf);
    expect(result.highlights).toHaveLength(0);
    expect(result.pageCount).toBe(1);
  });
});
