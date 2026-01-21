# GitHub接続手順

## 🔐 Personal Access Token (PAT) の作成

GitHubにプッシュするには、Personal Access Tokenが必要です。

### 1. GitHubでPersonal Access Tokenを作成

1. GitHubにログイン
2. 右上のアイコン → **Settings**
3. 左メニューの一番下 → **Developer settings**
4. 左メニュー → **Personal access tokens** → **Tokens (classic)**
5. **Generate new token** → **Generate new token (classic)** をクリック
6. 以下の設定を行う：
   - **Note**: `タスク管理リポジトリ` など分かりやすい名前
   - **Expiration**: お好みで（90日、1年など）
   - **Select scopes**: 以下の権限にチェック
     - ✅ `repo` (Full control of private repositories)
7. **Generate token** をクリック
8. **⚠️ 重要**: 表示されたトークンをコピーして安全な場所に保存（後で見れません！）

### 2. GitHubでリポジトリを作成

1. GitHubにログイン
2. 右上の「+」→「New repository」をクリック
3. リポジトリ名を入力（例: `task-management`）
4. **Private**を選択（個人のタスク管理なので）
5. **Initialize this repository with a README** はチェックしない（既にローカルにファイルがあるため）
6. 「Create repository」をクリック

### 3. リモートリポジトリを追加してプッシュ

```bash
# リモートリポジトリを追加（リポジトリ名を実際のものに置き換える）
git remote add origin https://github.com/yutaro2413/リポジトリ名.git

# ブランチ名をmainに変更
git branch -M main

# GitHubにプッシュ（ユーザー名とパスワードを聞かれたら）
# ユーザー名: yutaro2413
# パスワード: 上で作成したPersonal Access Tokenを貼り付け
git push -u origin main
```

## 🔑 認証情報の保存（オプション）

毎回トークンを入力するのが面倒な場合は、Git Credential Managerを使うか、以下のコマンドで保存できます：

```bash
# Windows Credential Managerに保存（推奨）
git config --global credential.helper wincred
```

## ✅ 確認

プッシュが成功したら、GitHubのリポジトリページでファイルが表示されているか確認してください。

## 📝 今後の使い方

一度設定すれば、今後は以下のコマンドでプッシュできます：

```bash
git add .
git commit -m "コミットメッセージ"
git push
```

## ⚠️ セキュリティ注意事項

- Personal Access Tokenはパスワードと同じように扱ってください
- トークンは他人に共有しないでください
- トークンが漏洩した場合は、すぐにGitHubで無効化してください
