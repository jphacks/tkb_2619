import type { RoomSnapshot, Song, VoteEntry } from "@/types";
import { normalizeKey } from "@/lib/music-source";
import type { Recommendation } from "./recommend";

/**
 * 議事録の流れ: 曲の候補出し（投稿 / Spotifyデータ / AI）→ 候補ランキング → スワイプ投票 → 最終ランキング。
 * 重みは仮決定（TODO: デモでの体感を見て調整）。
 */
export const RANKING_WEIGHTS = {
  /** 何人が持ち込んだか（被りの人数） */
  coverage: 0.6,
  /** Spotifyで過去1ヶ月によく聴いた度合いの合計（議事録「聴いた回数の和」の代用） */
  listening: 0.4,
  /** AIレコメンドだけから来た曲 */
  aiOnly: 0.3,
  /** 持ち込まれた曲がAIの条件にも合う場合の加点 */
  aiBonus: 0.1,
  /**
   * 国籍が混ざった集団（議事録のパーティーの課題）: 全員に合わせると定番曲ばかりになるため、
   * 人気が高すぎない曲を少し加点する（議事録「曲のニッチ度合い」）
   */
  nicheBonus: 0.1,
  /** 最終ランキング = 候補ランキング 40% + スワイプ平均 60% */
  finalPre: 0.4,
  finalVote: 0.6,
};

export interface PoolItem {
  key: string;
  song: Song;
  /** 同じ曲として扱う曲ID（Spotify/MusicBrainz/カタログで別IDになる） */
  songIds: string[];
  memberIds: string[];
  listening: number;
  fromSpotify: boolean;
  fromManual: boolean;
  ai: Recommendation | null;
  preScore: number;
}

export interface RankedItem extends PoolItem {
  voteCount: number;
  voteAverage: number | null;
  pt: number;
}

/** ジャケット・SpotifyIDなど情報の多い方の曲データを代表にする */
function richer(a: Song, b: Song): Song {
  const score = (s: Song) => (s.spotifyId ? 2 : 0) + (s.artworkUrl ? 1 : 0) + (s.metaStatus === "done" ? 1 : 0);
  return score(b) > score(a) ? b : a;
}

export function buildCandidatePool(snapshot: RoomSnapshot, aiRecommendations: Recommendation[]): PoolItem[] {
  const memberCount = Math.max(snapshot.members.length, 1);
  const byKey = new Map<string, PoolItem>();

  // Geminiが選んだ曲（ホストが保存）は「誰かが持ち込んだ曲」ではなくAIのおすすめとして扱い、カタログからのおすすめより先に置く
  const geminiPicks: Recommendation[] = snapshot.candidates
    .filter((c) => c.source === "ai")
    .map((c) => ({ song: c.song, score: c.weight, reason: c.song.aiReason ?? "AIのおすすめ" }));

  for (const c of snapshot.candidates) {
    if (c.source === "ai") continue;
    const key = normalizeKey(c.song);
    const item = byKey.get(key) ?? {
      key,
      song: c.song,
      songIds: [],
      memberIds: [],
      listening: 0,
      fromSpotify: false,
      fromManual: false,
      ai: null,
      preScore: 0,
    };
    item.song = richer(item.song, c.song);
    if (!item.songIds.includes(c.songId)) item.songIds.push(c.songId);
    if (!item.memberIds.includes(c.memberId)) item.memberIds.push(c.memberId);
    if (c.source === "spotify") {
      item.fromSpotify = true;
      item.listening += c.weight;
    } else {
      item.fromManual = true;
    }
    byKey.set(key, item);
  }

  for (const rec of [...geminiPicks, ...aiRecommendations]) {
    const key = normalizeKey(rec.song);
    const item = byKey.get(key);
    if (item) {
      item.ai = item.ai ?? rec;
      continue;
    }
    byKey.set(key, {
      key,
      song: rec.song,
      songIds: [rec.song.id],
      memberIds: [],
      listening: 0,
      fromSpotify: false,
      fromManual: false,
      ai: rec,
      preScore: 0,
    });
  }

  const W = RANKING_WEIGHTS;
  const items = [...byKey.values()];
  for (const item of items) {
    const brought = item.memberIds.length > 0;
    let score = brought
      ? W.coverage * (item.memberIds.length / memberCount) + W.listening * Math.min(1, item.listening / memberCount)
      : W.aiOnly * (item.ai?.score ?? 0);
    if (brought && item.ai) score += W.aiBonus * item.ai.score;
    if (snapshot.room.conditions.nationalities.length >= 2 && item.song.popularity !== undefined) {
      score += W.nicheBonus * (1 - item.song.popularity / 100);
    }
    item.preScore = score;
  }

  return items.sort((a, b) => b.preScore - a.preScore || b.memberIds.length - a.memberIds.length);
}

/**
 * スワイプ投票に回す曲。候補は件数を絞らず全部、候補ランキングの上位から順に出す
 * （途中で投票が途切れないように。議事録「投稿までのランキング上位からスワイプ」）
 */
export function voteDeck(pool: PoolItem[]): PoolItem[] {
  return pool;
}

/** 投票は代表曲のIDに付くが、同じ曲の別IDへの投票もまとめて数える */
function votesFor(item: PoolItem, votes: VoteEntry[]): VoteEntry[] {
  return votes.filter((v) => item.songIds.includes(v.songId) || v.songId === item.song.id);
}

/** その人がこの曲をすでに評価（スキップ含む）したか */
export function myVoteFor(item: PoolItem, votes: VoteEntry[], memberId: string): VoteEntry | undefined {
  return votesFor(item, votes).find((v) => v.memberId === memberId);
}

/** 最終ランキング（議事録「投稿までのランキング出力＋スワイプスコア」） */
export function rankWithVotes(pool: PoolItem[], votes: VoteEntry[]): RankedItem[] {
  const maxPre = Math.max(...pool.map((p) => p.preScore), 0.0001);
  const W = RANKING_WEIGHTS;
  return pool
    .map((item) => {
      const scored = votesFor(item, votes).filter((v) => v.score !== null);
      const voteAverage = scored.length > 0 ? scored.reduce((sum, v) => sum + (v.score ?? 0), 0) / scored.length : null;
      const pre = item.preScore / maxPre;
      const pt = voteAverage === null ? W.finalPre * pre : W.finalPre * pre + W.finalVote * (voteAverage / 3);
      return { ...item, voteCount: scored.length, voteAverage, pt: Math.round(pt * 100) };
    })
    // 投票が1票でもある曲を上に。未投票の曲は候補としての強さだけで点が付き、投票結果に見えてしまうため下に回す
    .sort((a, b) => Number(b.voteCount > 0) - Number(a.voteCount > 0) || b.pt - a.pt || b.preScore - a.preScore);
}
