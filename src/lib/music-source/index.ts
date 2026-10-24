import { mockMusicSource } from "./mock";
import { musicBrainzMusicSource } from "./musicbrainz";
import { normalizeKey } from "./normalize";
import type { MusicSourceAdapter, SongQuery } from "./types";

/**
 * アプリが使う公開楽曲データ源。
 * - カタログ（レコメンドの母集団）: キュレーション済みのモックカタログ
 *   （MusicBrainzには人気度がなく、属性だけで選ぶと誰も知らない曲ばかりになるため）
 * - 検索: カタログ内の一致を先に、続けて MusicBrainz の結果を返す
 */
export const musicSource: MusicSourceAdapter = {
  getAllSongs: () => mockMusicSource.getAllSongs(),
  async searchSongs(query: SongQuery) {
    const local = await mockMusicSource.searchSongs(query);
    const remote = await musicBrainzMusicSource.searchSongs(query).catch((error) => {
      if (local.length === 0) throw error;
      return [];
    });
    const seen = new Set(local.map(normalizeKey));
    return [...local, ...remote.filter((s) => !seen.has(normalizeKey(s)))];
  },
};

export type { MusicSourceAdapter, SongQuery };
export { MOCK_SONGS } from "./mock";
export { normalizeKey } from "./normalize";
