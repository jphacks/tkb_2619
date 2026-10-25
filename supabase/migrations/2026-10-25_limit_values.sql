-- 公開鍵（anon key）で書き込める値の「列」「形」「大きさ」をデータベース側でも制限する。
-- アプリ側の変更は不要。SQL Editor で1回実行してください（何度実行しても同じ結果になります）。
-- 既存の行は検査せず（not valid）、これから書き込まれる行にだけ適用します。

-- ルームは「幹事・次に流す曲・AIのおすすめ」だけ更新できる（条件・IDなどの書き換えを禁止）
revoke update on rooms from anon;
grant update (host_member_id, final_song_id, ai_picks) on rooms to anon;

-- ルーム
alter table rooms drop constraint if exists rooms_id_format;
alter table rooms add constraint rooms_id_format check (id ~ '^[a-z0-9]{10}$') not valid;
alter table rooms drop constraint if exists rooms_conditions_size;
alter table rooms add constraint rooms_conditions_size
  check (jsonb_typeof(conditions) = 'object' and octet_length(conditions::text) <= 4000) not valid;
alter table rooms drop constraint if exists rooms_ai_picks_size;
alter table rooms add constraint rooms_ai_picks_size
  check (jsonb_typeof(ai_picks) = 'array' and octet_length(ai_picks::text) <= 32000) not valid;
alter table rooms drop constraint if exists rooms_ref_length;
alter table rooms add constraint rooms_ref_length
  check (char_length(coalesce(host_member_id, '')) <= 64 and char_length(coalesce(final_song_id, '')) <= 200) not valid;

-- 参加者
alter table members drop constraint if exists members_id_length;
alter table members add constraint members_id_length check (char_length(id) <= 64) not valid;

-- 候補曲（曲データ1件は数百バイト）
alter table candidates drop constraint if exists candidates_values;
alter table candidates add constraint candidates_values check (
  char_length(song_id) <= 200
  and jsonb_typeof(song) = 'object'
  and octet_length(song::text) <= 8000
  and weight between 0 and 1
) not valid;

-- 投票
alter table votes drop constraint if exists votes_song_id_length;
alter table votes add constraint votes_song_id_length check (char_length(song_id) <= 200) not valid;
