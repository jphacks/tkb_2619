import type { RoomSnapshot } from "@/types";
import { generateMemberId, generateRoomId, type RoomBackend } from "./backend";
import { parseAiPicks, parseConditions } from "./sanitize";

/**
 * Supabase未設定時のローカル用バックエンド。
 * localStorageに保存し、BroadcastChannelで同じブラウザの別タブへ変更を通知する。
 * 別の端末とは共有できない（招待URLを他のスマホで開いても「ルームが見つかりません」になる）。
 */

const keyFor = (roomId: string) => `musicconnect-local-room-${roomId}`;
const listeners = new Map<string, Set<() => void>>();
let channel: BroadcastChannel | null = null;

// ビルド時（Node.js）に生成するとプロセスが終了しなくなるため、ブラウザで初めて使う時に作る
function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel("musicconnect-rooms");
    channel.addEventListener("message", (event: MessageEvent<string>) => {
      listeners.get(event.data)?.forEach((fn) => fn());
    });
  }
  return channel;
}

function notify(roomId: string) {
  listeners.get(roomId)?.forEach((fn) => fn());
  getChannel()?.postMessage(roomId);
}

function load(roomId: string): RoomSnapshot | null {
  const raw = localStorage.getItem(keyFor(roomId));
  if (!raw) return null;
  const snapshot = JSON.parse(raw) as RoomSnapshot;
  return {
    ...snapshot,
    room: {
      ...snapshot.room,
      conditions: parseConditions(snapshot.room.conditions),
      aiPicks: parseAiPicks(snapshot.room.aiPicks),
    },
  };
}

function update(roomId: string, mutate: (snapshot: RoomSnapshot) => void) {
  const snapshot = load(roomId);
  if (!snapshot) throw new Error("ルームが見つかりません");
  mutate(snapshot);
  localStorage.setItem(keyFor(roomId), JSON.stringify(snapshot));
  notify(roomId);
}

const now = () => new Date().toISOString();

export const localBackend: RoomBackend = {
  kind: "local",

  async createRoom(input) {
    const room = { id: generateRoomId(), ...input, hostMemberId: null, finalSongId: null, aiPicks: [], createdAt: now() };
    localStorage.setItem(keyFor(room.id), JSON.stringify({ room, members: [], candidates: [], votes: [] }));
    return room;
  },

  async joinRoom(roomId, { name, kind }) {
    const member = { id: generateMemberId(), roomId, name, kind, joinedAt: now() };
    update(roomId, (s) => {
      s.members.push(member);
    });
    return member;
  },

  async setHost(roomId, memberId) {
    update(roomId, (s) => {
      s.room.hostMemberId = memberId;
    });
  },

  async addCandidates(entries) {
    if (entries.length === 0) return;
    update(entries[0].roomId, (s) => {
      for (const entry of entries) {
        s.candidates = s.candidates.filter((c) => !(c.memberId === entry.memberId && c.songId === entry.songId));
        s.candidates.push({ ...entry, addedAt: now() });
      }
    });
  },

  async removeCandidate(roomId, memberId, songId) {
    update(roomId, (s) => {
      s.candidates = s.candidates.filter((c) => !(c.memberId === memberId && c.songId === songId));
    });
  },

  async updateCandidateSongs(roomId, memberId, songs) {
    const byId = new Map(songs.map((song) => [song.id, song]));
    update(roomId, (s) => {
      s.candidates = s.candidates.map((c) =>
        c.memberId === memberId && byId.has(c.songId) ? { ...c, song: byId.get(c.songId)! } : c
      );
    });
  },

  async setVote(roomId, memberId, songId, score) {
    update(roomId, (s) => {
      s.votes = s.votes.filter((v) => !(v.memberId === memberId && v.songId === songId));
      s.votes.push({ roomId, memberId, songId, score, updatedAt: now() });
    });
  },

  async deleteVote(roomId, memberId, songId) {
    update(roomId, (s) => {
      s.votes = s.votes.filter((v) => !(v.memberId === memberId && v.songId === songId));
    });
  },

  async setFinalSong(roomId, songId) {
    update(roomId, (s) => {
      s.room.finalSongId = songId;
    });
  },

  async setAiPicks(roomId, picks) {
    update(roomId, (s) => {
      s.room.aiPicks = picks;
    });
  },

  async fetchSnapshot(roomId) {
    return load(roomId);
  },

  subscribe(roomId, onChange) {
    getChannel();
    const set = listeners.get(roomId) ?? new Set();
    set.add(onChange);
    listeners.set(roomId, set);
    const onStorage = (event: StorageEvent) => {
      if (event.key === keyFor(roomId)) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      set.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  },
};
