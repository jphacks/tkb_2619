# recommend（Gemini による AIレコメンド）

ホストの端末がこの関数を呼び、Gemini が選んだ曲をルームの候補（`source = 'ai'`）として保存する。
Gemini の APIキーはこの関数の中でだけ使い、ブラウザには出さない。

関数が未デプロイ・キー未登録・SQL未実行のどれかでも、アプリは従来のカタログ（65曲）のおすすめで動き続ける。

## セットアップ（Supabase プロジェクト `uvjwhufzoqcztdhqdxgs` の権限が必要）

### 1. Gemini の APIキーを登録する

1. Google AI Studio（https://aistudio.google.com/ ）で APIキーを発行する
2. Supabase ダッシュボード → Edge Functions → Secrets で次を追加する
   - `GEMINI_API_KEY` = 発行したキー
   - （任意）`GEMINI_MODEL` = 使うモデル名。未設定なら `gemini-2.5-flash`

キーはコードや GitHub に書かないこと。

### 2. データベースに 'ai' を追加する

Supabase ダッシュボード → SQL Editor で、`supabase/migrations/2026-10-25_ai_candidates.sql` の中身を1回実行する。

### 3. 関数をデプロイする

どちらか一方でよい。

- **ダッシュボード**: Edge Functions → Deploy a new function → Via Editor。名前を `recommend` にして、`index.ts` の中身を貼り付けて Deploy
- **CLI**:
  ```bash
  supabase login
  supabase functions deploy recommend --project-ref uvjwhufzoqcztdhqdxgs
  ```

`verify_jwt`（JWT の検証）は既定の ON のままでよい。アプリは公開鍵（anon key）を付けて呼ぶ。

## 動作確認

1. 公開サイトでルームを作る（AIレコメンド ON）。作った人がホストになる
2. 参加して手動で2〜3曲追加し、5秒ほど待つ
3. 投票・結果画面に「AIおすすめ」の曲が増えていれば成功
   - Supabase の Table Editor → `candidates` に `source = ai` の行ができる
   - 失敗時はブラウザのコンソールに「Geminiのおすすめを取得できませんでした」と出る。Edge Functions → recommend → Logs でエラー内容を確認できる

## 仕組みと制限

- 存在しないルームからの呼び出しは 404、同じルームからは20秒に1回まで（429）
  - 回数制限は関数のインスタンス内で数えている簡易版。インスタンスが入れ替わるとリセットされる
- 返す曲は最大15曲。アプリ側で iTunes 検索にかけ、曲名とアーティスト名が一致したものだけを使う
- ホストの端末は、持ち込まれた曲かルームの条件が変わったときだけ呼ぶ。同じ状態では（失敗しても）呼び直さない
