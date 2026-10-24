import type { Vote } from "@/types";

export interface VoteSummary {
  songId: string;
  voteCount: number;
  averageScore: number; // 0〜3
  normalizedScore: number; // 0〜1
}

/** 曲ごとの投票を集計する（平均スコアと投票人数） */
export function summarizeVotes(votes: Vote[]): Map<string, VoteSummary> {
  const bySong = new Map<string, Vote[]>();
  for (const vote of votes) {
    const list = bySong.get(vote.songId) ?? [];
    list.push(vote);
    bySong.set(vote.songId, list);
  }

  const summaries = new Map<string, VoteSummary>();
  for (const [songId, songVotes] of bySong) {
    const total = songVotes.reduce((sum, v) => sum + v.score, 0);
    const averageScore = total / songVotes.length;
    summaries.set(songId, {
      songId,
      voteCount: songVotes.length,
      averageScore,
      normalizedScore: averageScore / 3,
    });
  }

  return summaries;
}

/** 指定の参加者・曲に対する既存の投票を取得する */
export function findVote(votes: Vote[], participantId: string, songId: string): Vote | undefined {
  return votes.find((v) => v.participantId === participantId && v.songId === songId);
}
