# musicconnect（音楽で人と人を繋ぐ）

### 🎵 [今すぐアプリを開く（GitHub Pages）](https://jphacks.github.io/tkb_2619/)

インストール不要ですぐ開けます。

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/jphacks/tkb_2619?quickstart=1)

コードを編集したい場合は上のバッジから GitHub Codespaces を起動できます（`npm install` → `npm run dev` まで自動実行）。

## 製品概要
### 背景(製品開発のきっかけ、課題等）
人との交流 × 音楽に付随する課題を解決する。

| シーン | ギャップ | 起きていること |
| --- | --- | --- |
| カラオケ | 世代（上司と部下） | 知っていても歌えるとは限らない。色々な世代がいる中で一緒に歌える曲を選びたい |
| パーティー | 国籍（留学生・インバウンド） | 言語も好みも違う。全員に合わせようとすると定番曲ばかりになる |
| ドライブ | 音楽ジャンル | 同乗者の好みが分からず、場の雰囲気に合う曲を選べない |

共通の課題は「相手の曲の好みが分からず選曲できない」「好みが合えば距離が縮まるのに、それが実現できていない」こと。

### 製品説明（具体的な製品の説明）
**共通の一曲が、心を繋ぐ。** musicconnect は、みんなが知っている曲・聴きたい曲を、投票で選ぶ選曲ルームです。

1. **ルームを作成**: 場を仕切る人が、集まる人たちの属性（性別・ジャンル・国籍・年代を複数選択＋その他の自由入力）を決め、招待URLを発行
2. **ルームに参加**: 招待された人は「Spotifyで登録・連携」か「アカウントを持っていない」で参加
3. **曲の候補出し（3種類）**
   - Spotifyデータ: 過去1ヶ月によく聴いた曲を取り込み、**被っている曲**を抽出
   - 手動: 検索・おすすめから候補を追加
   - AIレコメンド: 条件と参加者の好みの周辺から提案（OFFにすると投稿とSpotifyデータのみ）
4. **スワイプで投票**: 候補ランキング上位10曲を、上=Best(3点) / 右=Better(2点) / 下=Meh(1点) / 左=Nope(0点) で評価
5. **みんなのランキング**: 投票が入るたびにリアルタイムで順位が更新。曲を流す人が最後に1曲を選び、Spotifyで再生

### 特長
#### 1. 「被る曲」の抽出
Spotifyで過去1ヶ月によく聴いた曲（トップトラック）を参加者ごとに取り込み、タイトル＋アーティスト名で重複を判定。被った人数とよく聴いた度合いの合計で候補をランキングする。

#### 2. スワイプ投票とリアルタイムランキング
マッチングアプリのような上下左右スワイプで0〜3点の評価。候補ランキング（40%）とスワイプ平均（60%）で最終順位を決め、全員の画面にリアルタイムで反映する。

#### 3. 条件付きAIレコメンド
集まる人たちの属性（複数選択）・自由入力（例:「みんなで歌える、明るい曲がいい」）と、参加者が持ち込んだ曲の傾向から候補を提案。年代に「20〜30代」「40〜50代」を選べば両方の世代に届く曲ほど上位になるなど、**集団全体をカバーできる曲**を優先する。国籍が混ざっているときは定番曲ばかりにならないよう、人気が高すぎない曲を少し優遇する。

### 解決出来ること
- 選曲にかかる時間を短縮し、「知らない曲で場が冷める」を防ぐ
- 世代・国籍・ジャンルのギャップがある相手とも、知らなかった共通の曲が見つかる
- 投票を通じて、その場にいる全員の好みを可視化できる

### 今後の展望
- 「その他」の自由入力をLLMで解釈する（APIキーを隠すため Supabase Edge Function 経由で呼び出す）
- 世代別・国別の実際のチャートデータでAIレコメンドの母集団を拡充（現在はキュレーション済みカタログ）
- 曲名の表記揺れ（Idol / アイドル）の同一視、ジャンル／アーティスト単位の緩い一致
- Spotifyのプレイリスト自動生成、ルームごとの参加トークンによるアクセス制御

### 注力したこと（こだわり等）
* 議事録の機能（候補出し3種 → 投票 → リコメンド → 曲を流す）をそのまま1つのルーム体験にまとめた
* サーバーなし（GitHub Pages）で、Spotifyログイン（PKCE）・MusicBrainz・Supabase Realtime をブラウザから直接使う構成
* 外部データ取得層（`src/lib/music-source/`）とルームの保存先（`src/lib/room/`）をインターフェースで分離。Supabase未設定でも同じブラウザ内のデモモードで全機能が動く

## セットアップ手順

### GitHub Codespaces（インストール不要・一番簡単）
上部の「Open in GitHub Codespaces」バッジをクリックするだけで起動できます。

### ローカル環境で起動する場合
```bash
npm install
npm run dev
```

`http://127.0.0.1:3000` を開いてください（Spotifyログインは `localhost` では使えないため）。

### Supabase（招待URLで複数の端末から共有する）
未設定の場合は「デモモード」になり、ルームは同じブラウザ内（タブ間）だけで共有されます。

1. [Supabase](https://supabase.com/) でプロジェクトを作成
2. SQL Editor に [`supabase/schema.sql`](supabase/schema.sql) を貼り付けて実行
3. Project Settings → API の **Project URL** と **anon public キー** を `.env.local` に設定（`.env.example` 参照）。公開サイトに反映するには `src/lib/config.ts` の既定値かGitHub Actionsの環境変数に設定する
4. **service_role キーは秘密鍵なので、絶対にコードや `.env` に置かないこと**

### Spotify（[ダッシュボード](https://developer.spotify.com/dashboard)）
- Redirect URIs に `https://jphacks.github.io/tkb_2619/callback` と `http://127.0.0.1:3000/callback` を登録
- 開発モードのアプリは **User Management に登録したアカウントだけ** ログインできる
- Client ID はPKCE方式では公開されて問題ない値のため、コードに既定値として入っている。**Client Secret はこのアプリでは使わない**
- Codespaces のURLは登録していないため、CodespacesではSpotifyログインは使えない

## 開発技術
### 活用した技術
#### API・データ
* Spotify Web API: 過去1ヶ月のトップトラック（`time_range=short_term`）。再生回数は取得できないため、順位から求めた重みで代用
* MusicBrainz API / Cover Art Archive: 曲検索、アーティストの国・ジャンル、ジャケット画像
* Supabase（Postgres + Realtime）: ルーム・参加者・候補・投票の共有とリアルタイム更新
* キュレーション済み楽曲カタログ（`src/lib/music-source/catalog.ts`）: AIレコメンドの母集団

#### フレームワーク・ライブラリ・モジュール
* Next.js (App Router, 静的書き出し) / TypeScript / Tailwind CSS
* framer-motion（スワイプUI）、lucide-react（アイコン）、@supabase/supabase-js

#### デバイス
* スマートフォン（モバイルファーストUI、タッチ・スワイプ操作を想定）

### 独自技術
#### ハッカソンで開発した独自機能・技術
* 候補ランキング（被った人数・よく聴く度合い・AI・ニッチ度）と最終ランキング: [`src/lib/logic/ranking.ts`](src/lib/logic/ranking.ts)
* 条件付きAIレコメンド・あなたへのおすすめ: [`src/lib/logic/recommend.ts`](src/lib/logic/recommend.ts)
* ルームの保存先の抽象化（Supabase / ブラウザ内デモ）: [`src/lib/room/`](src/lib/room/)
* スワイプ投票カード: [`src/components/VoteCard.tsx`](src/components/VoteCard.tsx)
