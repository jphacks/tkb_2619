import type { Nationality, Song } from "@/types";
import {
  canonicalArtist,
  colorsForId,
  generationsForYear,
  mapCountryToNationality,
  mapTagsToGenre,
  normalizeKey,
  parseYear,
} from "./normalize";

/**
 * MusicBrainz API（パブリック楽曲データ）。認証不要・ブラウザから直接呼べる（CORS許可済み）。
 * https://musicbrainz.org/doc/MusicBrainz_API
 * - 曲の検索、アーティストの国・ジャンルタグ、ジャケット画像（Cover Art Archive）を取得する。
 * - レート制限（1リクエスト/秒）のため、全リクエストを1本のキューで直列化している。
 * - ブラウザはUser-Agentを変更できないため、ヘッダーは付けられない。
 */

const API = "https://musicbrainz.org/ws/2";
const MIN_INTERVAL_MS = 1100;

type Job = () => Promise<void>;
const highPriority: Job[] = [];
const lowPriority: Job[] = [];
let working = false;
let lastRequestAt = 0;

/** 検索（high）はジャケット・ジャンル補完（low）より先に処理する */
async function work() {
  if (working) return;
  working = true;
  while (highPriority.length > 0 || lowPriority.length > 0) {
    const job = (highPriority.shift() ?? lowPriority.shift())!;
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    await job();
  }
  working = false;
}

function request<T>(path: string, params: Record<string, string>, priority: "high" | "low" = "low"): Promise<T> {
  const url = `${API}/${path}?${new URLSearchParams({ ...params, fmt: "json" })}`;
  return new Promise<T>((resolve, reject) => {
    let attempts = 0;
    const job: Job = async () => {
      try {
        const res = await fetch(url);
        if (res.status === 503 && attempts++ < 2) {
          lastRequestAt = Date.now() + 1500;
          (priority === "high" ? highPriority : lowPriority).unshift(job);
          return;
        }
        if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
        resolve((await res.json()) as T);
      } catch (error) {
        reject(error);
      }
    };
    (priority === "high" ? highPriority : lowPriority).push(job);
    void work();
  });
}

function escapeLucene(text: string): string {
  return text.trim().replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");
}

const coverUrl = (releaseId: string) => `https://coverartarchive.org/release/${releaseId}/front-250`;

/** ライブ・リミックス・映像・カラオケ版などの別収録を除外する */
export const NOISE = /(live|tour|映像|ノンクレジット|music video|remix|instrumental|off vocal|karaoke|カラオケ|acoustic|ver\.|version|demo|tv size|inst\.)/i;
/** カバー・BGMアレンジ専門のアーティストを除外する */
export const COVER_ARTIST = /(8-bit|arcade|tribute|cover|オルゴール|music box|piano|lullaby|karaoke|カラオケ)/i;

interface MbTag {
  name: string;
  count: number;
}

interface MbRelease {
  id: string;
  status?: string;
}

interface MbRecording {
  id: string;
  title: string;
  score: number;
  disambiguation?: string;
  "first-release-date"?: string;
  "artist-credit"?: { name: string; joinphrase?: string; artist: { id: string; name: string } }[];
  releases?: MbRelease[];
}

interface MbArtist {
  id: string;
  name: string;
  score?: number;
  country?: string;
  tags?: MbTag[];
  genres?: MbTag[];
}

/** 1つの検索窓の入力から、「曲名 アーティスト」「アーティスト 曲名」のどちらの順でも当たるクエリを作る */
function buildRecordingQuery(input: string): string {
  const q = input.trim();
  const tokens = q.split(/\s+/);
  const parts = [`recording:"${escapeLucene(q)}"^2`, `artist:"${escapeLucene(q)}"`];
  if (tokens.length > 1) {
    const [first, last] = [tokens[0], tokens[tokens.length - 1]];
    parts.unshift(
      `(recording:"${escapeLucene(tokens.slice(0, -1).join(" "))}" AND artist:"${escapeLucene(last)}")^6`,
      `(recording:"${escapeLucene(tokens.slice(1).join(" "))}" AND artist:"${escapeLucene(first)}")^6`
    );
  }
  return parts.join(" OR ");
}

/**
 * 曲を検索する。MusicBrainzには人気度がないため、同名のカバー曲が上位に来やすい。
 * knownArtists（カタログやルーム内のアーティスト）に含まれる結果を先頭に並べて緩和している。
 */
export async function searchRecordings(input: string, knownArtists: Set<string> = new Set()): Promise<Song[]> {
  if (!input.trim()) return [];
  const data = await request<{ recordings?: MbRecording[] }>(
    "recording",
    { query: buildRecordingQuery(input), limit: "40" },
    "high"
  );

  const byKey = new Map<string, Song>();
  for (const rec of data.recordings ?? []) {
    const release = rec.releases?.find((r) => r.status === "Official");
    if (!release || rec.score < 50 || NOISE.test(rec.title) || NOISE.test(rec.disambiguation ?? "")) continue;
    const credits = rec["artist-credit"] ?? [];
    const artist = credits.map((c) => c.name + (c.joinphrase ?? "")).join("") || "不明なアーティスト";
    if (COVER_ARTIST.test(artist)) continue;
    const year = parseYear(rec["first-release-date"]);
    const key = normalizeKey({ title: rec.title, artist });
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
      artist,
      genre: "other",
      year,
      generationTags: generationsForYear(year),
      nationalityTags: [],
      ...colorsForId(id),
      origin: "musicbrainz",
      artworkUrl: coverUrl(release.id),
      metaStatus: "pending",
      mbArtistId: credits[0]?.artist.id,
    });
  }

  const known = new Set([...knownArtists].map((a) => canonicalArtist(a).toLowerCase()));
  const isKnown = (song: Song) => known.has(canonicalArtist(song.artist).toLowerCase());
  // アーティスト名そのもので検索された場合は、そのアーティスト本人の曲だけにする（同名タイトルのカバーを除く）
  const searchedArtist = canonicalArtist(input).toLowerCase();
  const songs = Array.from(byKey.values());
  const filtered = known.has(searchedArtist)
    ? songs.filter((s) => canonicalArtist(s.artist).toLowerCase() === searchedArtist)
    : songs;
  return filtered.sort((a, b) => Number(isKnown(b)) - Number(isKnown(a))).slice(0, 10);
}

function readCache<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache<T>(key: string, cache: Record<string, T>) {
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // 容量超過・プライベートモード等では諦める（次回また取得するだけ）
  }
}

const ARTWORK_CACHE = "musicconnect-artwork-v1";

/** ジャケット画像URL（Cover Art Archive）をMusicBrainzから探す。結果はブラウザにキャッシュ */
export async function lookupArtwork(song: Pick<Song, "title" | "artist">): Promise<string | null> {
  const key = normalizeKey(song);
  const cache = readCache<string | null>(ARTWORK_CACHE);
  if (key in cache) return cache[key];

  const query = `recording:"${escapeLucene(song.title)}" AND artist:"${escapeLucene(canonicalArtist(song.artist))}"`;
  const data = await request<{ recordings?: MbRecording[] }>("recording", { query, limit: "10" });
  const release = (data.recordings ?? [])
    .filter((r) => !NOISE.test(r.title))
    .flatMap((r) => r.releases ?? [])
    .find((r) => r.status === "Official");
  const url = release ? coverUrl(release.id) : null;

  const latest = readCache<string | null>(ARTWORK_CACHE);
  latest[key] = url;
  writeCache(ARTWORK_CACHE, latest);
  return url;
}

export interface ArtistMeta {
  country?: string;
  tags: string[];
}

const ARTIST_CACHE = "musicconnect-mb-artist-v1";

function sortedTagNames(artist: MbArtist): string[] {
  return [...(artist.genres ?? []), ...(artist.tags ?? [])].sort((a, b) => b.count - a.count).map((t) => t.name);
}

/** アーティストの国・ジャンルタグ（IDがあればID検索、なければ名前検索）。結果はブラウザにキャッシュ */
export async function lookupArtistMeta(name: string, mbArtistId?: string): Promise<ArtistMeta | null> {
  const cacheKey = mbArtistId ?? `name:${canonicalArtist(name).toLowerCase()}`;
  const cache = readCache<ArtistMeta | null>(ARTIST_CACHE);
  if (cacheKey in cache) return cache[cacheKey];

  let meta: ArtistMeta | null = null;
  if (mbArtistId) {
    const artist = await request<MbArtist>(`artist/${encodeURIComponent(mbArtistId)}`, { inc: "genres+tags" });
    meta = { country: artist.country, tags: sortedTagNames(artist) };
  } else {
    const data = await request<{ artists?: MbArtist[] }>("artist", {
      query: escapeLucene(canonicalArtist(name)),
      limit: "1",
    });
    const top = data.artists?.[0];
    if (top && (top.score ?? 0) >= 90) meta = { country: top.country, tags: sortedTagNames(top) };
  }

  const latest = readCache<ArtistMeta | null>(ARTIST_CACHE);
  latest[cacheKey] = meta;
  writeCache(ARTIST_CACHE, latest);
  return meta;
}

/** アーティスト情報から曲のジャンル・国籍タグを埋める */
export function applyArtistMeta(song: Song, meta: ArtistMeta | null): Song {
  const nationality: Nationality | undefined = mapCountryToNationality(meta?.country);
  return {
    ...song,
    genre: meta ? mapTagsToGenre(meta.tags, nationality) : song.genre,
    nationalityTags: nationality ? [nationality] : song.nationalityTags,
    metaStatus: "done",
  };
}
