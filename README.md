# 💪 GymWatch セットアップガイド

## 必要なもの
- GitHubアカウント（作成済み）
- Supabaseアカウント（作成済み）
- Vercelアカウント（作成済み）

---

## Step 1：Supabaseの接続情報を取得

1. https://supabase.com にログイン
2. 作成したプロジェクトを開く
3. 左メニュー「Settings」→「API」をクリック
4. 以下をメモしておく：
   - **Project URL**（`https://xxxx.supabase.co` の形式）
   - **anon public key**（`eyJ...` で始まる長い文字列）

---

## Step 2：.env.localファイルを編集

`.env.local` ファイルを開いて、以下のように書き換える：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx...
```

---

## Step 3：GitHubにアップロード

1. GitHubで新しいリポジトリを作成（名前：`gymwatch`）
2. このフォルダの中身を全部アップロード
   ※ `.env.local` は **アップロードしない**（.gitignoreで除外済み）

---

## Step 4：Vercelにデプロイ

1. https://vercel.com にログイン
2. 「New Project」→ GitHubのgymwatchリポジトリを選択
3. 「Environment Variables」に以下を追加：
   - `NEXT_PUBLIC_SUPABASE_URL` = SupabaseのURL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = SupabaseのAnon Key
4. 「Deploy」ボタンを押す
5. 数分後にURLが発行される！

---

## Step 5：Supabaseで認証URLを設定

1. Supabase → Settings → Authentication → URL Configuration
2. Site URL に VercelのURL（`https://gymwatch-xxx.vercel.app`）を設定
3. 保存

---

## 完成！
VercelのURLにアクセスしてアカウント登録しよう 🎉
