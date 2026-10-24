-- ルーム作成画面から「シーン」を削除したため、rooms.scene 列を削除する。
-- 2026-10-24 より前に schema.sql を実行したプロジェクトでだけ、SQL Editor で1回実行してください。
alter table rooms drop column if exists scene;
