# 一時的に無効化している機能

UI から外しているがコードと DB スキーマは残してある機能の一覧と、再有効化の手順。

`app/src/lib/features.ts` の真偽値を `true` にすると即座に UI に出る。データベースは何も変更しない。

## Web Clipper（Pocket 代替・記事保存）

- フラグ: `features.webClipper`
- 影響箇所:
  - `/settings` の「Web Clipper（記事・選択範囲を保存）」セクション
  - `/books` のフィルタタブ「Web」
- 残しているコード:
  - `app/src/components/WebClipperSetup.tsx`
  - `app/src/app/api/clipper/save/route.ts`
  - `app/public/bookmarklet/web-clipper.js`
  - `app/src/lib/clipper.ts`（URL 正規化・externalId 生成）
  - `app/src/lib/clipper.test.ts`
  - `app/src/lib/syncAuth.ts`（Kindle と共有のシェアードシークレット）
- 残しているスキーマ:
  - `Book.url` / `Book.excerpt` / `Book.siteName` / `Book.publishedAt`
  - `source="web"` の Book レコードがあれば残る（ただし UI 上は非表示）
- 復活手順:
  1. `features.webClipper = true` にする
  2. 既存の Kindle 同期トークン (`KINDLE_SYNC_TOKEN` または `SYNC_TOKEN`) で動作するため追加設定不要

## PDF ハイライト取込

- フラグ: `features.pdfImport`
- 影響箇所:
  - `/books` の「📄 PDF からハイライト取込」ボタン
  - `/books` のフィルタタブ「PDF」
- 残しているコード:
  - `app/src/components/PdfImportButton.tsx`
  - `app/src/app/api/pdf/import/route.ts`
  - `app/src/lib/pdfHighlights.ts`（pdf-lib による /Highlight 注釈抽出）
  - `app/src/lib/pdfHighlights.test.ts`
- 残しているスキーマ: 共通の `Book(source="pdf")` と `Highlight` を流用、専用フィールドは無い
- 残しているパッケージ: `pdf-lib`（`package.json`）
- 復活手順:
  1. `features.pdfImport = true` にする

## 完全削除する場合

将来「やっぱり完全に消す」となったら：

```bash
# Web Clipper 削除
rm -rf app/src/app/api/clipper
rm app/public/bookmarklet/web-clipper.js
rm app/src/components/WebClipperSetup.tsx
rm app/src/lib/clipper.ts app/src/lib/clipper.test.ts
# Book schema から url/excerpt/siteName/publishedAt を削除し prisma db push

# PDF 削除
rm -rf app/src/app/api/pdf
rm app/src/components/PdfImportButton.tsx
rm app/src/lib/pdfHighlights.ts app/src/lib/pdfHighlights.test.ts
npm uninstall pdf-lib
```

ただし source="web"/"pdf" のレコードが残っていると UI から見えなくなるだけで DB には残るので、必要なら以下も実行：

```sql
DELETE FROM "Highlight" WHERE "bookId" IN (SELECT id FROM "Book" WHERE source IN ('web','pdf'));
DELETE FROM "Book" WHERE source IN ('web','pdf');
```
