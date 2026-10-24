import type { CandidateSong, Participant, Song } from "@/types";
import { normalizeKey } from "@/lib/music-source";

/**
 * 共通曲抽出: 参加者それぞれの「知ってる曲」リストから重複を集計し、
 * 知っている人数が多い順にランキングする。
 *
 * 「曲が被っている」の判定基準は現状タイトル＋アーティスト名の完全一致
 * （normalizeKey）。将来的にはジャンル/アーティスト単位の緩い一致にも
 * 拡張したい（TODOは normalizeKey 側に記載）。
 */
export function extractCommonSongs(
  participants: Participant[],
  allSongs: Song[]
): CandidateSong[] {
  const songById = new Map(allSongs.map((s) => [s.id, s]));
  const countByKey = new Map<string, { song: Song; count: number }>();

  for (const participant of participants) {
    const seenKeys = new Set<string>();
    for (const songId of participant.knownSongIds) {
      const song = songById.get(songId);
      if (!song) continue;
      const key = normalizeKey(song);
      // 同一参加者が同じ曲を複数回カウントしないようにする
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const entry = countByKey.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        countByKey.set(key, { song, count: 1 });
      }
    }
  }

  const totalParticipants = Math.max(participants.length, 1);

  return Array.from(countByKey.values())
    .map<CandidateSong>(({ song, count }) => ({
      song,
      source: "common",
      knownByCount: count,
      knownByRatio: count / totalParticipants,
      recommendScore: 0,
    }))
    .sort((a, b) => b.knownByCount - a.knownByCount);
}
