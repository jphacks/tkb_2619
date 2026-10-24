import type { Nationality, Song } from "@/types";
import type { MusicSourceAdapter, SongQuery } from "./types";
import {
  colorsForId,
  generationsForYear,
  mapCountryToNationality,
  mapTagsToGenre,
  normalizeKey,
  parseYear,
} from "./normalize";

/**
 * MusicBrainz API アダプター（パブリック楽曲データ）。認証不要・ブラウザから直接呼べる（CORS許可済み）。
 * https://musicbrainz.org/doc/MusicBrainz_API
 * - レート制限: 1リクエスト/秒が目安のため、全リクエストを1本のキューで直列化している。
 * - ブラウザはUser-Agentを変更できないため、ヘッダーは付けられない。
 * - MusicBrainzには人気度の指標がないため、レコメンドの母集団はキュレーション済みカタログ（mock.ts）のまま。
 */

const API = "https://musicbrainz.org/ws/2";
const MIN_INTERVAL_MS = 1100;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function request<T>(path: string, params: Record<string, string>): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    const url = `${API}/${path}?${new URLSearchParams({ ...params, fmt: "json" })}`;
    let res = await fetch(url);
    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 2000));
      lastRequestAt = Date.now();
      res = await fetch(url);
    }
    if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
    return res.json() as Promise<T>;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** Luceneの特殊文字をエスケープ */
function escapeLucene(text: string): string {
  return text.trim().replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");
}

interface MbTag {
  name: string;
  count: number;
}

interface MbRecording {
  id: string;
  title: string;
  score: number;
  "first-release-date"?: string;
  "artist-credit"?: { name: string; joinphrase?: string; artist: { id: string; name: string } }[];
}

interface MbArtist {
  id: string;
  name: string;
  score?: number;
  country?: string;
  tags?: MbTag[];
  genres?: MbTag[];
}

export async function searchRecordings({ title, artist }: SongQuery): Promise<Song[]> {
  if (!title.trim()) return [];
  const query = artist?.trim()
    ? `recording:"${escapeLucene(title)}" AND artist:"${escapeLucene(artist)}"`
    : `recording:"${escapeLucene(title)}"`;
  const data = await request<{ recordings?: MbRecording[] }>("recording", { query, limit: "25" });

  // 同じ曲の別収録（再発・ライブ等）が多数返るので、タイトル＋アーティストでまとめて最古の年を採用する
  const byKey = new Map<string, Song>();
  for (const rec of data.recordings ?? []) {
    if (rec.score < 60) continue;
    const credits = rec["artist-credit"] ?? [];
    const artistName = credits.map((c) => c.name + (c.joinphrase ?? "")).join("") || "不明なアーティスト";
    const year = parseYear(rec["first-release-date"]);
    const key = normalizeKey({ title: rec.title, artist: artistName });
    const existing = byKey.get(key);
    if (existing) {
      if (year && (!existing.year || year < existing.year)) {
        existing.year = year;
        existing.generationTags = generationsForYear(year);
      }
      continue;
    }
    const id = `mb:${rec.id}`;
    byKey.set(key, {
      id,
      title: rec.title,
      artist: artistName,
      genre: "other",
      year,
      generationTags: generationsForYear(year),
      nationalityTags: [],
      ...colorsForId(id),
      origin: "musicbrainz",
      metaStatus: "pending",
      mbArtistId: credits[0]?.artist.id,
    });
  }
  return Array.from(byKey.values()).slice(0, 8);
}

export interface ArtistMeta {
  country?: string;
  tags: string[];
}

const CACHE_KEY = "music-bridge-mb-artist-cache-v1";

function readCache(): Record<string, ArtistMeta | null> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, ArtistMeta | null>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 容量超過・プライベートモード等では諦める（毎回取得し直すだけ）
  }
}

function sortedTagNames(artist: MbArtist): string[] {
  const tags = [...(artist.genres ?? []), ...(artist.tags ?? [])];
  return tags.sort((a, b) => b.count - a.count).map((t) => t.name);
}

/** アーティストの国・ジャンルタグを取得（IDがあればID検索、なければ名前検索）。結果はlocalStorageにキャッシュ */
export async function lookupArtistMeta(name: string, mbArtistId?: string): Promise<ArtistMeta | null> {
  const cacheKey = mbArtistId ?? `name:${name.toLowerCase()}`;
  const cache = readCache();
  if (cacheKey in cache) return cache[cacheKey];

  let meta: ArtistMeta | null = null;
  if (mbArtistId) {
    const artist = await request<MbArtist>(`artist/${mbArtistId}`, { inc: "genres+tags" });
    meta = { country: artist.country, tags: sortedTagNames(artist) };
  } else {
    const data = await request<{ artists?: MbArtist[] }>("artist", { query: escapeLucene(name), limit: "1" });
    const top = data.artists?.[0];
    if (top && (top.score ?? 0) >= 90) meta = { country: top.country, tags: sortedTagNames(top) };
  }

  cache[cacheKey] = meta;
  writeCache(cache);
  return meta;
}

/** 取得したアーティスト情報から、曲のジャンル・国籍タグを埋める */
export function applyArtistMeta(song: Song, meta: ArtistMeta | null): Song {
  const nationality: Nationality | undefined = mapCountryToNationality(meta?.country);
  return {
    ...song,
    genre: meta ? mapTagsToGenre(meta.tags, nationality) : song.genre,
    nationalityTags: nationality ? [nationality] : song.nationalityTags,
    metaStatus: "done",
  };
}

export const musicBrainzMusicSource: Pick<MusicSourceAdapter, "searchSongs"> = {
  searchSongs: searchRecordings,
};
