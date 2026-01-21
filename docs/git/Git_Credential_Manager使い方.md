# Git Credential Manager 使い方ガイド

## 🔐 Git Credential Managerとは

Git Credential Managerは、Gitの認証情報（ユーザー名とPAT）を安全に保存・管理するツールです。Windowsでは標準で利用できます。

## ✅ 現在の設定確認

既に以下の設定が完了しています：

```bash
git config --global credential.helper wincred
```

これにより、Windows Credential Managerに認証情報が保存されます。

## 🚀 使い方

### 1. 初回の認証情報保存

次回 `git push` を実行すると、認証情報の入力が求められます：

```bash
git push
```

認証を求められたら：
- **Username**: `yutaro2413`
- **Password**: PATを貼り付け

一度入力すると、Windows Credential Managerに保存され、次回以降は自動で認証されます。

### 2. 保存された認証情報の確認

#### Windows Credential Managerで確認

1. Windowsキーを押して「資格情報マネージャー」と検索
2. 「Windows資格情報」を開く
3. `git:https://github.com` というエントリが表示されます

#### コマンドで確認

```bash
cmdkey /list
```

### 3. 認証情報の更新・削除

#### 削除する場合

```bash
cmdkey /delete:git:https://github.com
```

または、Windows Credential Managerから手動で削除：
1. 「Windows資格情報」を開く
2. `git:https://github.com` を探して削除

#### 更新する場合

1. 古い認証情報を削除
2. 再度 `git push` を実行して新しいPATを入力

### 4. 動作確認

認証情報が正しく保存されているか確認：

```bash
# プッシュを試す（認証情報が保存されていれば、入力なしで実行される）
git push
```

## 🔒 セキュリティのベストプラクティス

### ✅ 推奨される方法

1. **PATをURLに含めない**（✅ 既に削除済み）
2. **Windows Credential Managerに保存**（✅ 設定済み）
3. **PATは定期的に更新する**（90日〜1年ごと）

### ⚠️ 注意事項

- PATはパスワードと同じように扱う
- PATをコードやファイルに直接書かない
- PATが漏洩した場合は、すぐにGitHubで無効化する

## 📝 今後の使い方

一度認証情報が保存されれば、通常のGit操作で自動認証されます：

```bash
# ファイルを追加
git add .

# コミット
git commit -m "feat: 週次タスク追加 (2024/01/24-01/30)"

# プッシュ（認証情報は自動で使用される）
git push
```

## 🛠️ トラブルシューティング

### 認証エラーが発生する場合

1. 認証情報を削除：
   ```bash
   cmdkey /delete:git:https://github.com
   ```

2. 再度プッシュして新しいPATを入力：
   ```bash
   git push
   ```

### PATが期限切れになった場合

1. GitHubで新しいPATを作成
2. 古い認証情報を削除：
   ```bash
   cmdkey /delete:git:https://github.com
   ```
3. 再度プッシュして新しいPATを入力

### Git Credential Managerが動作しない場合

再設定：

```bash
git config --global credential.helper wincred
```

または、Git Credential Manager Coreを使用：

```bash
git config --global credential.helper manager-core
```

## 📚 参考情報

- [Git Credential Manager 公式ドキュメント](https://github.com/GitCredentialManager/git-credential-manager)
- [GitHub Personal Access Tokens](https://github.com/settings/tokens)
