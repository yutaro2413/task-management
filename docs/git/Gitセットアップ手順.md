# Git/GitHub セットアップ手順

## 📋 前提条件

- Gitがインストールされていること
- GitHubアカウントを持っていること

## 🚀 セットアップ手順

### 0. Gitのユーザー情報を設定（初回のみ）

GitHubアカウントの情報を使って設定します：

```bash
# ユーザー名を設定（GitHubのユーザー名に置き換える）
git config --global user.name "YourGitHubUsername"

# メールアドレスを設定（GitHubに登録しているメールアドレスに置き換える）
git config --global user.email "your-email@example.com"
```

**注意**: 
- GitHubでメールアドレスを非公開にしている場合は、GitHubの設定から「Keep my email addresses private」の下に表示される`username@users.noreply.github.com`形式のメールアドレスを使用してください
- 確認方法: GitHub → Settings → Emails → 「Keep my email addresses private」の下に表示されるメールアドレス

### 1. Gitリポジトリの初期化

```bash
# プロジェクトディレクトリに移動
cd "G:\マイドライブ\90.Work\MiyaiYutaro\20.cursol"

# Gitリポジトリを初期化（✅ 完了済み）
git init

# 現在のファイルをステージング（✅ 完了済み）
git add .

# 初回コミット（ユーザー情報設定後に実行）
git commit -m "feat: 初期セットアップ - タスク整理システム"
```

### 2. GitHubでリポジトリを作成

1. GitHubにログイン
2. 右上の「+」→「New repository」をクリック
3. リポジトリ名を入力（例: `task-management`）
4. **Private**を選択（個人のタスク管理なので）
5. 「Create repository」をクリック

### 3. リモートリポジトリを追加

```bash
# リモートリポジトリを追加（URLは実際のものに置き換える）
git remote add origin https://github.com/your-username/task-management.git

# ブランチ名をmainに設定（必要に応じて）
git branch -M main

# GitHubにプッシュ
git push -u origin main
```

## 📝 日常的な使い方

### 週の初め（計画を立てた後）

```bash
git add .
git commit -m "feat: 週次タスク追加 (2024/01/24-01/30)"
git push
```

### タスクの進捗更新

```bash
git add .
git commit -m "update: タスク進捗更新 - 注文内容API連携完了"
git push
```

### 週次レビュー（週末）

```bash
git add .
git commit -m "docs: 週次レビュー追加 - 2024/01/24週"
git push
```

## 🔄 コミットメッセージの規約（推奨）

- `feat:` - 新しいタスクや機能の追加
- `update:` - タスクの進捗更新
- `fix:` - タスクの修正
- `docs:` - レビューや思考の整理の追加
- `refactor:` - タスクの再構成

例：
- `feat: Shopify対応タスク追加`
- `update: 人事制度導入 進捗50%に更新`
- `docs: 週次レビュー - 2024/01/24週`

## 💡 メリット

✅ **変更履歴の追跡**: いつ何を変更したかが分かる  
✅ **バックアップ**: GitHubに自動バックアップ  
✅ **過去の参照**: 過去の計画や振り返りを簡単に参照  
✅ **進捗の可視化**: コミット履歴で進捗を確認  

## 🔒 プライバシー

個人のタスク管理なので、**Privateリポジトリ**で作成することをお勧めします。
