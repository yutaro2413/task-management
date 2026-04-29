This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 環境変数

| 名前 | 用途 |
|------|------|
| `DATABASE_URL` | PostgreSQL 接続文字列（Vercel Postgres / Neon など） |
| `KINDLE_SYNC_TOKEN` | Kindle ハイライト同期ブックマークレットの認証用シェアードシークレット。任意のランダム文字列を Vercel ダッシュボードに設定し、設定ページで同じ値を入力する |

## Kindle ハイライト同期

`/settings` の「Kindle ハイライト同期」セクションでブックマークレットを生成し、ブラウザのブックマークバーに登録する。`https://read.amazon.co.jp/notebook` を開いた状態でブックマークをクリックすると、表示中の全書籍のハイライト・しおり・図表ハイライトを `/api/kindle/sync` に POST し、`/books` で書籍ごとに参照できるようになる。

- ASIN 単位で書籍を upsert するため何度実行しても重複しない
- 既存書籍のタイトル・著者・カバーは尊重し（ユーザー編集を保護）、欠けているフィールドだけ自動補完する
- カバー・著者・出版社は Google Books API（キーレス）でフォールバック取得

## 書籍データベース移行（一回限り）

旧 `BookTitle` / `ReadingLog` から新 `Book` モデルへ移行するため、デプロイ後に下記を一度だけ実行する。

```bash
curl -X POST https://<your-app>/api/migrate-books-from-titles
```

冪等。実行後、既存の読書ログは新 `Book` レコードに紐づき、`/books` 一覧から閲覧できるようになる。
