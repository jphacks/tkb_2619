import type { Song } from "@/types";
import { canonicalArtist, looseText, normalizeKey } from "./normalize";

/**
 * 30秒の試聴音源（Apple の iTunes プレビュー）を探す。認証不要・ブラウザから直接呼べる。
 * - iTunes から追加した曲は ID で直接引き、それ以外は「曲名 アーティスト名」で検索して一致するものを使う
 * - 見つからなかった結果も含めて端末に覚えておき、同じ曲を何度も検索しない（iTunes は1分あたりの回数に上限がある）
 */

// v2: アーティスト名のカタカナ表記に対応した。以前「見つからない」と保存した結果は使わない
const CACHE_KEY = "musicconnect-preview-v2";
const memory = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

interface ItunesResult {
  trackName: string;
  artistName: string;
  previewUrl?: string;
}

function readCache(): Record<string, string | null> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(key: string, url: string | null) {
  try {
    const cache = readCache();
    cache[key] = url;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 保存できなくても、次に開いたときに探し直すだけ
  }
}

function matches(result: ItunesResult, song: Pick<Song, "title" | "artist">): boolean {
  const a = looseText(canonicalArtist(result.artistName));
  const b = looseText(canonicalArtist(song.artist));
  const t1 = looseText(result.trackName);
  const t2 = looseText(song.title);
  return (a.includes(b) || b.includes(a)) && (t1.startsWith(t2) || t2.startsWith(t1));
}

async function fetchResults(url: string): Promise<ItunesResult[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  return ((await res.json()) as { results?: ItunesResult[] }).results ?? [];
}

async function find(song: Song): Promise<string | null> {
  if (song.id.startsWith("itunes:")) {
    const params = new URLSearchParams({ id: song.id.slice(7), country: "JP" });
    const [hit] = await fetchResults(`https://itunes.apple.com/lookup?${params}`);
    if (hit?.previewUrl) return hit.previewUrl;
  }
  const params = new URLSearchParams({
    term: `${song.title} ${song.artist}`,
    country: "JP",
    media: "music",
    entity: "song",
    limit: "10",
    lang: "ja_jp",
  });
  const results = (await fetchResults(`https://itunes.apple.com/search?${params}`)).filter((r) => r.previewUrl);
  // 日本のストアでは海外アーティストがカタカナ表記（Queen → クイーン）になるため、
  // アーティスト名が一致しなくても、曲名が完全に同じなら採用する（検索語にアーティスト名を入れているので、上位はほぼ本人）
  const exact = results.find((r) => matches(r, song)) ?? results.find((r) => looseText(r.trackName) === looseText(song.title));
  return exact?.previewUrl ?? null;
}

/** 試聴音源のURL。見つからなければ null */
export function lookupPreviewUrl(song: Song): Promise<string | null> {
  const key = normalizeKey(song);
  if (memory.has(key)) return Promise.resolve(memory.get(key) ?? null);
  const cached = readCache()[key];
  if (cached !== undefined) {
    memory.set(key, cached);
    return Promise.resolve(cached);
  }
  const running = inflight.get(key);
  if (running) return running;
  const task = find(song)
    .then((url) => {
      memory.set(key, url);
      writeCache(key, url);
      return url;
    })
    // 通信エラーは覚えない（次に再生するときにもう一度探す）
    .catch(() => null)
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

/** すでに分かっている試聴URL（まだ探していなければ undefined）。タップ直後に同期で再生するために使う */
export function knownPreviewUrl(song: Song): string | null | undefined {
  return memory.get(normalizeKey(song));
}
