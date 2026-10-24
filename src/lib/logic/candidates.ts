import type { CandidateSong } from "@/types";
import { normalizeKey } from "@/lib/music-source/normalize";

/** スワイプ投票に回す最大曲数（Spotify取り込みで数百曲になってもスワイプしきれる量に抑える） */
export const MAX_VOTE_CANDIDATES = 30;

/**
 * 投票候補の並びを決める:
 * 1. 2人以上が知っている共通曲（被りの多い順）と投稿曲は必ず入れる
 * 2. 残り枠は「1人だけが知っている曲」と「属性レコメンド」を交互に詰める
 */
export function buildVoteCandidates(
  common: CandidateSong[],
  submitted: CandidateSong[],
  recommended: CandidateSong[],
  max = MAX_VOTE_CANDIDATES
): CandidateSong[] {
  const shared = common.filter((c) => c.knownByCount >= 2);
  const single = common.filter((c) => c.knownByCount < 2);

  const seen = new Set<string>();
  const result: CandidateSong[] = [];
  const push = (c: CandidateSong) => {
    const key = normalizeKey(c.song);
    if (seen.has(c.song.id) || seen.has(key)) return;
    seen.add(c.song.id);
    seen.add(key);
    result.push(c);
  };

  submitted.forEach(push);
  shared.slice(0, Math.max(max - result.length, 0)).forEach(push);

  for (let i = 0; result.length < max && (i < single.length || i < recommended.length); i++) {
    if (single[i]) push(single[i]);
    if (result.length < max && recommended[i]) push(recommended[i]);
  }

  // 被りの多い曲を先頭にしつつ、投稿曲はその直後に並べる
  return [
    ...result.filter((c) => c.knownByCount >= 2),
    ...result.filter((c) => c.knownByCount < 2),
  ];
}
