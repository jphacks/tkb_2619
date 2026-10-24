import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CandidateEntry, Member, Room, VoteEntry } from "@/types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { generateMemberId, generateRoomId, type RoomBackend } from "./backend";

/**
 * Supabase（Postgres + Realtime）を使った本番用バックエンド。
 * テーブル定義・アクセス権は supabase/schema.sql を参照。
 * 公開鍵（anon key）でブラウザから直接読み書きするため、ログイン不要で招待URLから参加できる。
 */

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return client;
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

interface RoomRow {
  id: string;
  scene: Room["scene"];
  ai_enabled: boolean;
  conditions: Room["conditions"];
  host_member_id: string | null;
  final_song_id: string | null;
  created_at: string;
}

interface MemberRow {
  id: string;
  room_id: string;
  name: string;
  kind: Member["kind"];
  joined_at: string;
}

interface CandidateRow {
  room_id: string;
  member_id: string;
  song_id: string;
  song: CandidateEntry["song"];
  source: CandidateEntry["source"];
  weight: number;
  added_at: string;
}

interface VoteRow {
  room_id: string;
  member_id: string;
  song_id: string;
  score: VoteEntry["score"];
  updated_at: string;
}

const toRoom = (r: RoomRow): Room => ({
  id: r.id,
  scene: r.scene,
  aiEnabled: r.ai_enabled,
  conditions: r.conditions,
  hostMemberId: r.host_member_id,
  finalSongId: r.final_song_id,
  createdAt: r.created_at,
});

const toMember = (r: MemberRow): Member => ({
  id: r.id,
  roomId: r.room_id,
  name: r.name,
  kind: r.kind,
  joinedAt: r.joined_at,
});

const toCandidate = (r: CandidateRow): CandidateEntry => ({
  roomId: r.room_id,
  memberId: r.member_id,
  songId: r.song_id,
  song: r.song,
  source: r.source,
  weight: r.weight,
  addedAt: r.added_at,
});

const toVote = (r: VoteRow): VoteEntry => ({
  roomId: r.room_id,
  memberId: r.member_id,
  songId: r.song_id,
  score: r.score,
  updatedAt: r.updated_at,
});

export const supabaseBackend: RoomBackend = {
  kind: "supabase",

  async createRoom({ scene, aiEnabled, conditions }) {
    const row = check(
      await db()
        .from("rooms")
        .insert({ id: generateRoomId(), scene, ai_enabled: aiEnabled, conditions })
        .select()
        .single()
    );
    return toRoom(row as RoomRow);
  },

  async joinRoom(roomId, { name, kind }) {
    const row = check(
      await db().from("members").insert({ id: generateMemberId(), room_id: roomId, name, kind }).select().single()
    );
    return toMember(row as MemberRow);
  },

  async setHost(roomId, memberId) {
    check(await db().from("rooms").update({ host_member_id: memberId }).eq("id", roomId));
  },

  async addCandidates(entries) {
    if (entries.length === 0) return;
    const rows = entries.map((e) => ({
      room_id: e.roomId,
      member_id: e.memberId,
      song_id: e.songId,
      song: e.song,
      source: e.source,
      weight: e.weight,
    }));
    check(await db().from("candidates").upsert(rows, { onConflict: "room_id,member_id,song_id" }));
  },

  async removeCandidate(roomId, memberId, songId) {
    check(
      await db().from("candidates").delete().match({ room_id: roomId, member_id: memberId, song_id: songId })
    );
  },

  async updateCandidateSongs(roomId, memberId, songs) {
    for (const song of songs) {
      check(
        await db().from("candidates").update({ song }).match({ room_id: roomId, member_id: memberId, song_id: song.id })
      );
    }
  },

  async setVote(roomId, memberId, songId, score) {
    check(
      await db()
        .from("votes")
        .upsert(
          { room_id: roomId, member_id: memberId, song_id: songId, score, updated_at: new Date().toISOString() },
          { onConflict: "room_id,member_id,song_id" }
        )
    );
  },

  async deleteVote(roomId, memberId, songId) {
    check(await db().from("votes").delete().match({ room_id: roomId, member_id: memberId, song_id: songId }));
  },

  async setFinalSong(roomId, songId) {
    check(await db().from("rooms").update({ final_song_id: songId }).eq("id", roomId));
  },

  async fetchSnapshot(roomId) {
    const room = check(await db().from("rooms").select().eq("id", roomId).maybeSingle()) as RoomRow | null;
    if (!room) return null;
    const [members, candidates, votes] = await Promise.all([
      db().from("members").select().eq("room_id", roomId).order("joined_at"),
      db().from("candidates").select().eq("room_id", roomId).order("added_at"),
      db().from("votes").select().eq("room_id", roomId),
    ]);
    return {
      room: toRoom(room),
      members: (check(members) as MemberRow[]).map(toMember),
      candidates: (check(candidates) as CandidateRow[]).map(toCandidate),
      votes: (check(votes) as VoteRow[]).map(toVote),
    };
  },

  subscribe(roomId, onChange) {
    const filter = `room_id=eq.${roomId}`;
    // DELETEイベントはフィルタ指定できないため、主キーに含まれる room_id で自前で絞り込む
    const onDelete = (payload: { old: Record<string, unknown> }) => {
      if (payload.old?.room_id === roomId) onChange();
    };
    const channel = db()
      .channel(`room-${roomId}-${generateMemberId()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, onChange)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "members", filter }, onChange)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "candidates", filter }, onChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "candidates", filter }, onChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "candidates" }, onDelete)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes", filter }, onChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "votes", filter }, onChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "votes" }, onDelete)
      .subscribe();
    return () => {
      void db().removeChannel(channel);
    };
  },
};
