import type { AiPick, CandidateEntry, Member, Room, RoomConditions, RoomSnapshot, Song, VoteScore } from "@/types";

export interface NewRoomInput {
  aiEnabled: boolean;
  conditions: RoomConditions;
}

export type NewCandidate = Omit<CandidateEntry, "addedAt">;

/**
 * ルームの共有データ（参加者・候補曲・投票）の保存先。
 * - supabase.ts: 招待URLで複数の端末から参加し、リアルタイムに共有する本番用
 * - local.ts: Supabase未設定時のローカル用（同じブラウザ内のタブ間だけで共有）
 */
export interface RoomBackend {
  readonly kind: "supabase" | "local";
  createRoom(input: NewRoomInput): Promise<Room>;
  joinRoom(roomId: string, input: { name: string; kind: Member["kind"] }): Promise<Member>;
  setHost(roomId: string, memberId: string): Promise<void>;
  /** 同じ (ルーム, 参加者, 曲) は上書き */
  addCandidates(entries: NewCandidate[]): Promise<void>;
  removeCandidate(roomId: string, memberId: string, songId: string): Promise<void>;
  /** MusicBrainzで補完した曲情報を反映する */
  updateCandidateSongs(roomId: string, memberId: string, songs: Song[]): Promise<void>;
  setVote(roomId: string, memberId: string, songId: string, score: VoteScore | null): Promise<void>;
  deleteVote(roomId: string, memberId: string, songId: string): Promise<void>;
  setFinalSong(roomId: string, songId: string | null): Promise<void>;
  /** AIのおすすめを保存する（全員が同じ結果を見られるように） */
  setAiPicks(roomId: string, picks: AiPick[]): Promise<void>;
  fetchSnapshot(roomId: string): Promise<RoomSnapshot | null>;
  /** 変更があったら onChange を呼ぶ。戻り値で購読解除 */
  subscribe(roomId: string, onChange: () => void): () => void;
}

const ROOM_ID_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

/** 招待URLに載るルームID（推測されにくい長さ、読み間違えやすい文字は除外） */
export function generateRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => ROOM_ID_CHARS[b % ROOM_ID_CHARS.length]).join("");
}

export function generateMemberId(): string {
  return crypto.randomUUID();
}
