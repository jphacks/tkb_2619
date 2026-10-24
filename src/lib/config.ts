/**
 * 公開して問題ない設定値（ブラウザに配信される）。
 * Supabaseの anon key は公開前提の鍵で、アクセス範囲は supabase/schema.sql のRLSポリシーで決まる。
 * service_role key（秘密鍵）は絶対にここに置かないこと。
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
