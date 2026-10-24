import type { Song } from "@/types";
import { COVER_ARTIST, NOISE } from "./musicbrainz";
import { colorsForId, generationsForYear, mapTagsToGenre, normalizeKey, parseYear } from "./normalize";

/**
 * iTunes Search API（Apple）。認証不要・ブラウザから直接呼べる（CORS許可済み）。
 * https://performance-partners.apple.com/search-api
 * - MusicBrainzは人気度を持たず、同名の無名曲が上位に来てしまうため、手動検索はこちらを優先する。
 * - 結果はAppleのストアでの人気順に近い並びで返る。
 */

const API = "https://itunes.apple.com/search";
/** 曲名に付くアレンジ・編集版の印（ピアノ版、パーティー用エディットなど） */
const ARRANGEMENT = /カバー|cover|ピアノ|piano|オルゴール|music box|edit\)|edit\]|bgm/i;

interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  primaryGenreName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
}

export async function searchItunes(input: string, limit = 15): Promise<Song[]> {
  const term = input.trim();
  if (!term) return [];
  const params = new URLSearchParams({ term, country: "JP", media: "music", entity: "song", limit: "40", lang: "ja_jp" });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
  const data = (await res.json()) as { results?: ItunesTrack[] };

  const byKey = new Map<string, Song>();
  for (const t of data.results ?? []) {
    // カバー・BGMアレンジ・ライブ版などは「知っている曲」ではないので除く
    if (NOISE.test(t.trackName) || COVER_ARTIST.test(t.artistName) || ARRANGEMENT.test(t.trackName)) continue;
    const key = normalizeKey({ title: t.trackName, artist: t.artistName });
    if (byKey.has(key)) continue;
    const id = `itunes:${t.trackId}`;
    const year = parseYear(t.releaseDate);
    byKey.set(key, {
      id,
      title: t.trackName,
      artist: t.artistName,
      genre: mapTagsToGenre(t.primaryGenreName ? [t.primaryGenreName] : []),
      year,
      generationTags: generationsForYear(year),
      nationalityTags: [],
      ...colorsForId(id),
      origin: "itunes",
      artworkUrl: t.artworkUrl100?.replace("100x100", "300x300"),
      // 国・ジャンルはルームに入れた後、MusicBrainzのアーティスト情報で補う
      metaStatus: "pending",
    });
    if (byKey.size >= limit) break;
  }
  return Array.from(byKey.values());
}
