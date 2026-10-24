/**
 * 公開して問題ない設定値（ブラウザに配信される）。
 * Supabaseの anon key は公開前提の鍵で、アクセス範囲は supabase/schema.sql のRLSポリシーで決まる。
 * service_role key（秘密鍵）は絶対にここに置かないこと。
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uvjwhufzoqcztdhqdxgs.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2andodWZ6b3FjenRkaHFkeGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4Mjc0MDksImV4cCI6MjEwODQwMzQwOX0.vGuN0gcJxZ74dTTUZlwOjLIZAvELlWtjHAkZZ8ikxe8";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
