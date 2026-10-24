-- AIレコメンド（Gemini）が選んだ曲を、ルームの候補として全員で共有するため、
-- candidates.source に 'ai' を追加する。
-- 2026-10-25 より前に schema.sql を実行したプロジェクトでだけ、SQL Editor で1回実行してください。
alter table candidates drop constraint if exists candidates_source_check;
alter table candidates add constraint candidates_source_check check (source in ('spotify', 'manual', 'ai'));
