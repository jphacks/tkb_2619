-- musicconnect: Supabase のテーブル定義
-- Supabase ダッシュボード → SQL Editor にこのファイルの内容を貼り付けて「Run」してください。
--
-- ログインなしで招待URLから参加できるよう、公開鍵（anon key）で読み書きを許可しています。
-- ルームIDは推測されにくいランダム文字列ですが、anon key を持つ人は全ルームを読めます。
-- ハッカソン用の設定のため、個人情報（本名・メールアドレス等）は保存しない設計にしています。
-- TODO: 本番運用するなら、ルームごとの参加トークンで行を絞るRLSに変更する。

create table if not exists rooms (
  id text primary key,
  scene text not null check (scene in ('karaoke', 'party', 'drive')),
  ai_enabled boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  host_member_id text,
  final_song_id text,
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

-- 行レベルセキュリティ（anon key からの読み書きを許可）
alter table rooms enable row level security;
alter table members enable row level security;
alter table candidates enable row level security;
alter table votes enable row level security;

drop policy if exists "rooms are public" on rooms;
create policy "rooms are public" on rooms for all to anon using (true) with check (true);
drop policy if exists "members are public" on members;
create policy "members are public" on members for all to anon using (true) with check (true);
drop policy if exists "candidates are public" on candidates;
create policy "candidates are public" on candidates for all to anon using (true) with check (true);
drop policy if exists "votes are public" on votes;
create policy "votes are public" on votes for all to anon using (true) with check (true);

-- リアルタイム更新（投票・候補・参加者の変化を全員の画面に即反映する）
alter publication supabase_realtime add table rooms, members, candidates, votes;
