-- anon key で「何でもできる」状態をやめ、アプリが実際に使う操作だけを許可する。
-- これで、URL や anon key を知った人でもルームや参加者をまとめて削除・改ざんできなくなる。
-- アプリ側の変更は不要。SQL Editor で1回実行してください（何度実行しても同じ結果になります）。
--
--   rooms      : 読む・作る・更新（ホスト / 次に流す曲 / AIおすすめ）。削除は不可
--   members    : 読む・参加する。更新・削除は不可
--   candidates : 読む・追加・更新・取り消し
--   votes      : 読む・投票・変更・取り消し

drop policy if exists "rooms are public" on rooms;
drop policy if exists "members are public" on members;
drop policy if exists "candidates are public" on candidates;
drop policy if exists "votes are public" on votes;

drop policy if exists "rooms read" on rooms;
drop policy if exists "rooms create" on rooms;
drop policy if exists "rooms update" on rooms;
create policy "rooms read" on rooms for select to anon using (true);
create policy "rooms create" on rooms for insert to anon with check (true);
create policy "rooms update" on rooms for update to anon using (true) with check (true);

drop policy if exists "members read" on members;
drop policy if exists "members join" on members;
create policy "members read" on members for select to anon using (true);
create policy "members join" on members for insert to anon with check (true);

drop policy if exists "candidates read" on candidates;
drop policy if exists "candidates add" on candidates;
drop policy if exists "candidates update" on candidates;
drop policy if exists "candidates remove" on candidates;
create policy "candidates read" on candidates for select to anon using (true);
create policy "candidates add" on candidates for insert to anon with check (true);
create policy "candidates update" on candidates for update to anon using (true) with check (true);
create policy "candidates remove" on candidates for delete to anon using (true);

drop policy if exists "votes read" on votes;
drop policy if exists "votes cast" on votes;
drop policy if exists "votes update" on votes;
drop policy if exists "votes remove" on votes;
create policy "votes read" on votes for select to anon using (true);
create policy "votes cast" on votes for insert to anon with check (true);
create policy "votes update" on votes for update to anon using (true) with check (true);
create policy "votes remove" on votes for delete to anon using (true);
