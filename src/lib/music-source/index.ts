import { CATALOG } from "./catalog";
import { searchRecordings } from "./musicbrainz";
import { canonicalArtist, normalizeKey } from "./normalize";
import type { MusicSourceAdapter } from "./types";

function searchCatalog(query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  return CATALOG.filter((song) => {
    const haystack = `${song.title} ${song.artist} ${canonicalArtist(song.artist)}`.toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });
}

/**
 * アプリが使う公開楽曲データ源。
 * - カタログ: キュレーション済みの曲（AIレコメンドの母集団）
 * - 検索: カタログ内の一致を先に、続けて MusicBrainz の結果（失敗してもカタログ結果は返す）
 */
export const musicSource: MusicSourceAdapter = {
  getCatalog: () => CATALOG,
  async searchSongs(query, knownArtists = new Set()) {
    const local = searchCatalog(query);
    const artists = new Set([...knownArtists, ...CATALOG.map((s) => s.artist)]);
    const remote = await searchRecordings(query, artists).catch((error) => {
      if (local.length === 0) throw error;
      return [];
    });
    const seen = new Set(local.map(normalizeKey));
    return [...local, ...remote.filter((s) => !seen.has(normalizeKey(s)))];
  },
};

export type { MusicSourceAdapter };
export { CATALOG, RELATED_ARTISTS } from "./catalog";
export { canonicalArtist, normalizeKey } from "./normalize";
