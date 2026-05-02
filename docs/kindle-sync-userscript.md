# Kindle ハイライト同期 — Tampermonkey ユーザースクリプト

最も手間が少ない同期方法。`read.amazon.co.jp/notebook` を開くと右上にボタンが常駐し、ワンクリックで全書籍のハイライトを取り込める。

## セットアップ（初回のみ）

### 1. Tampermonkey 拡張機能をインストール

[tampermonkey.net](https://www.tampermonkey.net/) からブラウザに追加（無料・5秒）。Chrome / Edge / Firefox / Safari 対応。

### 2. ユーザースクリプトをインストール

Chrome 最新版では「このウェブサイトからユーザースクリプトを追加できません」というブラウザ標準の警告が出てインストールリンクが弾かれることがある。3 つの方法のうちどれかで OK。

#### 方法 A: 直接リンク（Edge / Firefox は OK、Chrome は構成次第）

`/settings` の「⬇️ ユーザースクリプトをインストール」ボタンをクリック。Tampermonkey のインストール画面が出れば成功。Chrome の警告が出たら方法 B / C へ。

#### 方法 B: ダッシュボードから URL インストール（Chrome 推奨）

1. ブラウザツールバーの Tampermonkey アイコンをクリック → 「ダッシュボード」
2. 上部の「ユーティリティ」タブ
3. 「URL からインストール」欄にこの URL を貼り付け：
   ```
   https://<your-app>/userscript/kindle-sync.user.js
   ```
   `/settings` ページの「📋 ユーザースクリプト URL をコピー」ボタンで取得可能
4. 「インストール」を押す → install 画面で承認

#### 方法 C: スクリプト本体を直接貼り付け

1. Tampermonkey ダッシュボード → 「+」（新規スクリプト）タブ
2. エディタの中身を全て削除
3. `/settings` の「📋 スクリプトソースをコピー」ボタンで取得した内容を貼り付け
4. Ctrl+S / Cmd+S で保存

### 3. 同期トークンを設定

1. `https://read.amazon.co.jp/notebook` を開く → 右上に黒い「📚 Kindle Sync」パネルが表示される
2. ⚙ ボタンを押して、同期トークン（Vercel の `KINDLE_SYNC_TOKEN` と同じ値）を入力

## 日常使い

1. `https://read.amazon.co.jp/notebook` を開く
2. 左ペインを下までスクロール（Amazon の遅延読込で全冊表示するため）
3. 右上パネルの「同期実行」ボタンを押す
4. 完了表示を待つ（書籍数 × 数秒）

DevTools を開く必要はない。Console paste も不要。

## 自動アップデート

スクリプトには `@updateURL` が指定してあり、Tampermonkey が定期的に最新版を取りに来る（デフォルト 7 日間隔）。手動で更新したい場合は Tampermonkey の管理画面 → スクリプト一覧 →「アップデートを確認」。

ユーザースクリプト本体: [`app/public/userscript/kindle-sync.user.js`](../app/public/userscript/kindle-sync.user.js)

## トークン・エンドポイントの再設定

- 右上パネルの ⚙ ボタンを押すと、トークンとエンドポイントを再入力できる
- 値は Tampermonkey の `GM_setValue` で永続保存される（ブラウザを閉じても保持、Amazon ログアウトしても保持）

## 同期されるもの

- 全書籍のメタデータ（ASIN・タイトル・著者・カバー）
- 通常のハイライト（黄/青/桃/橙の色とテキスト）
- 図表ハイライト（画像 URL）
- Kindle 側で書いたメモ（`kindleNote` フィールドに保存。アプリ側のメモ `note` とは別フィールドで衝突しない）
- しおり

## 同期されないもの

- Kindle iOS / Mac / PC アプリ専用ハイライト（notebook ページに同期されないため）
- 暗号化された書籍の中身

## トラブルシュート

| 症状 | 原因と対処 |
|---|---|
| パネルが出ない | Tampermonkey が無効化されている / `@match` URL を変更してしまった。Tampermonkey 管理画面で確認 |
| 「書籍リストが見つかりません」 | 左ペインを最下部までスクロールしてから再実行（Amazon の遅延読込） |
| 「失敗: HTTP 401」 | トークンが間違っている。⚙ から再入力 |
| 「失敗: HTTP 500 KINDLE_SYNC_TOKEN is not configured」 | サーバ側の環境変数が未設定。Vercel ダッシュボードで設定して Redeploy |
| 「失敗: HTTP 401」かつトークンは正しいはず | サーバ側に余計な空白・改行が混入している可能性。Vercel の環境変数を再保存して Redeploy |
