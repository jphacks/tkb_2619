import type { CandidateSong, Vote } from "@/types";
import { summarizeVotes } from "./voting";

export interface RankedSong extends CandidateSong {
  voteCount: number;
  averageVoteScore: number; // 0〜3
  finalScore: number; // 0〜1
}

/**
 * ランキングアルゴリズム（簡易版）:
 * 「候補ランキング（共通曲の被り度合い or 属性マッチ度）」と「スワイプ投票スコア」の
 * 加重平均で最終順位を決める。重みは仮決定（TODO: デモ後にチューニング余地あり）。
 */
const COVERAGE_WEIGHT = 0.5;
const VOTE_WEIGHT = 0.5;

export function computeFinalRanking(candidates: CandidateSong[], votes: Vote[]): RankedSong[] {
  const voteSummaries = summarizeVotes(votes);

  const ranked = candidates.map<RankedSong>((candidate) => {
    const summary = voteSummaries.get(candidate.song.id);
    const voteCount = summary?.voteCount ?? 0;
    const averageVoteScore = summary?.averageScore ?? 0;
    const normalizedVoteScore = summary?.normalizedScore ?? 0;

    // 共通曲は knownByRatio、属性レコメンドのみの曲は recommendScore をベース指標とする
    const baseScore = candidate.source === "common" ? candidate.knownByRatio : candidate.recommendScore;

    const finalScore =
      voteCount > 0
        ? COVERAGE_WEIGHT * baseScore + VOTE_WEIGHT * normalizedVoteScore
        : baseScore;

    return {
      ...candidate,
      voteCount,
      averageVoteScore,
      finalScore,
    };
  });

  return ranked.sort((a, b) => b.finalScore - a.finalScore);
}
