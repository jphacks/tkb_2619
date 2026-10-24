-- AI（Gemini）のおすすめ曲をルームに保存し、参加者全員で同じ結果を使うための列。
-- 2026-10-24 より前に schema.sql を実行したプロジェクトでだけ、SQL Editor で1回実行してください。
alter table rooms add column if not exists ai_picks jsonb not null default '[]'::jsonb;
