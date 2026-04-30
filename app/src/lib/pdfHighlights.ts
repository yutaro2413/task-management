// PDF /Highlight annotation 抽出ライブラリ。
//
// 動作:
//   1. ArrayBuffer を pdf-lib で読み込み
//   2. 各ページの /Annots を走査し、/Subtype が /Highlight のものを拾う
//   3. /Contents (本文)、/T (作者)、/M (修正日)、/C (色)、/Rect、/QuadPoints を抽出
//   4. /Contents が空の場合は本文不明としてマーク (text="")
//
// 制約:
//   - 暗号化された PDF はサポート外 (pdf-lib が読めない)
//   - 画像のみの PDF (スキャンPDFなど) はテキスト無し
//   - /Contents が populated されていないハイライトは text="" になる
//
// この lib は純粋関数の単体テストが書きやすいよう、PDF parse は外部依存にせず
// pdf-lib の AST を直接読む。

import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRef, PDFString, PDFHexString } from "pdf-lib";

export type ExtractedHighlight = {
  page: number;             // 1-indexed
  text: string;             // /Contents (空なら "")
  note: string;             // popup の注釈 (任意、無ければ "")
  author: string | null;    // /T (作者)
  color: string | null;     // "yellow" | "blue" | "pink" | "orange" | null (RGB の近似マッピング)
  modifiedAt: Date | null;  // /M
  rect: [number, number, number, number] | null; // [x1, y1, x2, y2]
};

export type ExtractedDocument = {
  pageCount: number;
  highlights: ExtractedHighlight[];
};

const HIGHLIGHT_SUBTYPE = "Highlight";
const COLOR_BUCKETS: { name: string; r: number; g: number; b: number }[] = [
  { name: "yellow", r: 1, g: 1, b: 0 },
  { name: "orange", r: 1, g: 0.6, b: 0 },
  { name: "pink", r: 1, g: 0.5, b: 0.7 },
  { name: "blue", r: 0.4, g: 0.6, b: 1 },
];

// PDF /C は 0..1 の RGB 配列。最も近い基準色にマッピング。
export function mapPdfColor(rgb: number[] | null | undefined): string | null {
  if (!rgb || rgb.length < 3) return null;
  const [r, g, b] = rgb;
  let best = COLOR_BUCKETS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of COLOR_BUCKETS) {
    const d = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best.name;
}

// PDF の /M (modification date) は "D:YYYYMMDDHHmmSS+TZ" 形式
export function parsePdfDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return null;
  const [, Y, M, D, h = "00", min = "00", s = "00"] = m;
  const iso = `${Y}-${M}-${D}T${h}:${min}:${s}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function readString(value: unknown): string | null {
  if (value instanceof PDFString) return value.decodeText();
  if (value instanceof PDFHexString) return value.decodeText();
  if (typeof value === "string") return value;
  return null;
}

function readNumber(value: unknown): number | null {
  if (value instanceof PDFNumber) return value.asNumber();
  if (typeof value === "number") return value;
  return null;
}

function readNumberArray(value: unknown): number[] | null {
  if (value instanceof PDFArray) {
    const arr: number[] = [];
    for (let i = 0; i < value.size(); i++) {
      const n = readNumber(value.get(i));
      if (n == null) return null;
      arr.push(n);
    }
    return arr;
  }
  return null;
}

function dereference(doc: PDFDocument, value: unknown): unknown {
  if (value instanceof PDFRef) {
    return doc.context.lookup(value);
  }
  return value;
}

export async function extractHighlightsFromPdf(buffer: ArrayBuffer): Promise<ExtractedDocument> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const pages = pdf.getPages();
  const highlights: ExtractedHighlight[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const annotsValue = page.node.get(PDFName.of("Annots"));
    const annots = dereference(pdf, annotsValue);
    if (!(annots instanceof PDFArray)) continue;

    for (let j = 0; j < annots.size(); j++) {
      const annotValue = dereference(pdf, annots.get(j));
      if (!(annotValue instanceof PDFDict)) continue;

      const subtype = annotValue.get(PDFName.of("Subtype"));
      const subtypeName = subtype instanceof PDFName ? (subtype as PDFName).asString() : null;
      if (subtypeName !== `/${HIGHLIGHT_SUBTYPE}`) continue;

      const contents = readString(annotValue.get(PDFName.of("Contents"))) ?? "";
      const author = readString(annotValue.get(PDFName.of("T")));
      const modified = readString(annotValue.get(PDFName.of("M")));
      const colorRgb = readNumberArray(annotValue.get(PDFName.of("C")));
      const rect = readNumberArray(annotValue.get(PDFName.of("Rect")));

      // popup ノートの中身も拾う (Acrobat 等で「ハイライト + コメント」を付けたとき)
      let note = "";
      const popupRef = annotValue.get(PDFName.of("Popup"));
      const popup = dereference(pdf, popupRef);
      if (popup instanceof PDFDict) {
        const popupContents = readString(popup.get(PDFName.of("Contents")));
        if (popupContents) note = popupContents;
      }
      // /IRT (in reply to) で本ハイライトを参照する Text 注釈がメモを持つこともある。
      // それは年月かけて完全網羅するより /Contents と /Popup で十分カバーできる前提で省略。

      highlights.push({
        page: i + 1,
        text: contents.trim(),
        note: note.trim(),
        author: author?.trim() || null,
        color: mapPdfColor(colorRgb),
        modifiedAt: parsePdfDate(modified),
        rect: rect && rect.length >= 4 ? [rect[0], rect[1], rect[2], rect[3]] : null,
      });
    }
  }

  // 出現順 (ページ内では PDF 内部順) で返す。同一ページでは Y 座標降順 (＝上→下) にしたい
  // が、座標系がページ依存で複雑なため、抽出順そのままにする。
  return { pageCount: pages.length, highlights };
}

// クライアント側で使う excerpt 用ハッシュ。Highlight の externalId は server 側で本文ハッシュ等から生成するため、
// この関数はあくまで UI のキー用。
export function previewKey(h: ExtractedHighlight): string {
  return `p${h.page}-${h.rect?.join(",") ?? "norect"}-${h.text.slice(0, 24)}`;
}
