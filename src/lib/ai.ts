import { AGE_GROUPS, GENDERS, GENRES, NATIONALITIES, type AiPick, type RoomSnapshot, type Song } from "@/types";
import { CATALOG, canonicalArtist, normalizeKey } from "@/lib/music-source";
import { searchItunes } from "@/lib/music-source/itunes";
import { colorsForId, looseText } from "@/lib/music-source/normalize";
import { invokeEdgeFunction } from "@/lib/room/supabase";
import { isSupabaseConfigured } from "@/lib/config";
import type { PoolItem } from "@/lib/logic/ranking";

/** AIのおすすめ（Gemini）を呼ぶ Supabase Edge Function の名前（supabase/functions/recommend-songs） */
const FUNCTION_NAME = "recommend-songs";
const PICK_COUNT = 8;

interface FunctionResponse {
  songs: { title: string; artist: string; reason: string }[];
}

const labelsOf = <T extends string>(ids: T[], options: { id: T; label: string }[]) =>
  ids.map((id) => options.find((o) => o.id === id)?.label ?? id);

/**
 * AIが挙げた曲を、カタログか iTunes で実在の曲に照らし合わせる（ジャケット・年・ジャンルを付けるため）。
 * 見つからない曲も、AIが答えた曲名のまま候補に入れる。
 */
async function resolveSong(title: string, artist: string): Promise<Song> {
  const fromCatalog = CATALOG.find((s) => normalizeKey(s) === normalizeKey({ title, artist }));
  if (fromCatalog) return fromCatalog;

  const wantedTitle = looseText(title);
  const wantedArtist = looseText(canonicalArtist(artist));
  const results = await searchItunes(`${title} ${artist}`, 5).catch(() => []);
  const sameTitle = results.filter((s) => {
    const t = looseText(s.title);
    return t === wantedTitle || t.startsWith(wantedTitle) || wantedTitle.startsWith(t);
  });
  const match =
    sameTitle.find((s) => {
      const a = looseText(canonicalArtist(s.artist));
      return a.includes(wantedArtist) || wantedArtist.includes(a);
    }) ?? sameTitle[0];
  if (match) return match;

  const id = `ai:${normalizeKey({ title, artist })}`;
  return {
    id,
    title,
    artist,
    genre: "other",
    year: 0,
    generationTags: [],
    nationalityTags: [],
    ...colorsForId(id),
    origin: "ai",
  };
}

export function isAiAvailable(): boolean {
  return isSupabaseConfigured;
}

/** ルームの条件とみんなの曲をAIに渡し、おすすめ曲を返す（ルームへの保存は呼び出し側で行う） */
export async function requestAiPicks(snapshot: RoomSnapshot, pool: PoolItem[]): Promise<AiPick[]> {
  const c = snapshot.room.conditions;
  const brought = pool.filter((p) => p.memberIds.length > 0);
  const response = await invokeEdgeFunction<FunctionResponse>(FUNCTION_NAME, {
    attributes: {
      genders: labelsOf(c.genders, GENDERS),
      genres: labelsOf(c.genres, GENRES),
      nationalities: labelsOf(c.nationalities, NATIONALITIES),
      ageGroups: labelsOf(c.ageGroups, AGE_GROUPS),
    },
    other: c.other,
    likedSongs: brought.slice(0, 40).map((p) => ({ title: p.song.title, artist: p.song.artist, people: p.memberIds.length })),
    exclude: brought.slice(0, 120).map((p) => ({ title: p.song.title, artist: p.song.artist })),
    count: PICK_COUNT,
  });

  const picks: AiPick[] = [];
  const seen = new Set<string>();
  // iTunes のレート制限（1分あたり約20回）に配慮して1曲ずつ照合する
  for (const { title, artist, reason } of response.songs ?? []) {
    const song = await resolveSong(title, artist);
    const key = normalizeKey(song);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push({ song, reason });
  }
  return picks;
}
