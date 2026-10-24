import { isSupabaseConfigured } from "@/lib/config";
import { localBackend } from "./local";
import { supabaseBackend } from "./supabase";
import type { RoomBackend } from "./backend";

/** Supabaseが設定されていれば本番用、なければ同じブラウザ内だけで動くデモ用 */
export const roomBackend: RoomBackend = isSupabaseConfigured ? supabaseBackend : localBackend;

export type { NewCandidate, NewRoomInput, RoomBackend } from "./backend";
