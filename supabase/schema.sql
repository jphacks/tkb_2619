-- musicconnect: Supabase のテーブル定義
-- Supabase ダッシュボード → SQL Editor にこのファイルの内容を貼り付けて「Run」してください。
--
-- ログインなしで招待URLから参加できるよう、公開鍵（anon key）でアプリが使う操作だけを許可しています
-- （ルーム・参加者の削除や参加者情報の書き換えはできません）。
-- ルームIDは推測されにくい10文字のランダム文字列ですが、anon key を持つ人は全ルームを読めます。
-- そのため、個人情報（本名・メールアドレス等）は保存しない設計にしています。
-- 今後: 本番運用するなら、ルームごとの参加トークンで行を絞るRLSに変更する。

create table if not exists rooms (
  id text primary key,
  ai_enabled boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  host_member_id text,
  final_song_id text,
  ai_picks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id text primary key,
  room_id text not null references rooms (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('spotify', 'guest')),
  joined_at timestamptz not null default now()
);

create table if not exists candidates (
  room_id text not null references rooms (id) on delete cascade,
  member_id text not null references members (id) on delete cascade,
  song_id text not null,
  song jsonb not null,
  source text not null check (source in ('spotify', 'manual')),
  weight real not null default 0,
  added_at timestamptz not null default now(),
  primary key (room_id, member_id, song_id)
);

create table if not exists votes (
  room_id text not null references rooms (id) on delete cascade,
  member_id text not null references members (id) on delete cascade,
  song_id text not null,
  score smallint check (score between 0 and 3), -- null = 知らない・スキップ
  updated_at timestamptz not null default now(),
  primary key (room_id, member_id, song_id)
);

create index if not exists members_room_idx on members (room_id);
create index if not exists candidates_room_idx on candidates (room_id);
create index if not exists votes_room_idx on votes (room_id);

-- 行レベルセキュリティ（anon key にはアプリが使う操作だけを許可する。ルーム・参加者の削除は不可）
alter table rooms enable row level security;
alter table members enable row level security;
alter table candidates enable row level security;
alter table votes enable row level security;

-- 旧ポリシー（何でも許可）を消す
drop policy if exists "rooms are public" on rooms;
drop policy if exists "members are public" on members;
drop policy if exists "candidates are public" on candidates;
drop policy if exists "votes are public" on votes;

drop policy if exists "rooms read" on rooms;
create policy "rooms read" on rooms for select to anon using (true);
drop policy if exists "rooms create" on rooms;
create policy "rooms create" on rooms for insert to anon with check (true);
drop policy if exists "rooms update" on rooms;
create policy "rooms update" on rooms for update to anon using (true) with check (true);
drop policy if exists "members read" on members;
create policy "members read" on members for select to anon using (true);
drop policy if exists "members join" on members;
create policy "members join" on members for insert to anon with check (true);
drop policy if exists "candidates read" on candidates;
create policy "candidates read" on candidates for select to anon using (true);
drop policy if exists "candidates add" on candidates;
create policy "candidates add" on candidates for insert to anon with check (true);
drop policy if exists "candidates update" on candidates;
create policy "candidates update" on candidates for update to anon using (true) with check (true);
drop policy if exists "candidates remove" on candidates;
create policy "candidates remove" on candidates for delete to anon using (true);
drop policy if exists "votes read" on votes;
create policy "votes read" on votes for select to anon using (true);
drop policy if exists "votes cast" on votes;
create policy "votes cast" on votes for insert to anon with check (true);
drop policy if exists "votes update" on votes;
create policy "votes update" on votes for update to anon using (true) with check (true);
drop policy if exists "votes remove" on votes;
create policy "votes remove" on votes for delete to anon using (true);

-- 書き込める列・値の形と大きさの制限（supabase/migrations/2026-10-25_limit_values.sql と同じ）
revoke update on rooms from anon;
grant update (host_member_id, final_song_id, ai_picks) on rooms to anon;
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
alter table members drop constraint if exists members_id_length;
alter table members add constraint members_id_length check (char_length(id) <= 64) not valid;
alter table candidates drop constraint if exists candidates_values;
alter table candidates add constraint candidates_values check (
  char_length(song_id) <= 200
  and jsonb_typeof(song) = 'object'
  and octet_length(song::text) <= 8000
  and weight between 0 and 1
) not valid;
alter table votes drop constraint if exists votes_song_id_length;
alter table votes add constraint votes_song_id_length check (char_length(song_id) <= 200) not valid;

-- リアルタイム更新（投票・候補・参加者の変化を全員の画面に即反映する）
alter publication supabase_realtime add table rooms, members, candidates, votes;
