import { AGE_GROUPS, GENDERS, GENRES, NATIONALITIES, type CandidateEntry, type Room, type Song } from "@/types";
import { canonicalArtist, normalizeKey } from "@/lib/music-source";
import { searchItunes } from "@/lib/music-source/itunes";
import { invokeEdgeFunction } from "@/lib/room/supabase";

/**
 * AIレコメンド（Gemini）。Supabase Edge Function「recommend」経由で呼ぶ（APIキーはSupabase側にだけある）。
 * Geminiは実在しない曲を答えることがあるため、返ってきた曲は iTunes 検索で見つかったものだけを使う。
 */

interface GeminiSong {
  title: string;
  artist: string;
  reason: string;
}

const labelsOf = <T extends string>(ids: T[], options: { id: T; label: string }[]) =>
  ids.map((id) => options.find((o) => o.id === id)?.label ?? id);

/** 表記ゆれ（大文字小文字・空白・記号）を無視して比べる */
const loose = (text: string) => text.toLowerCase().replace(/[\s\-・'’"“”.,!?！？()（）[\]【】]/g, "");

function sameSong(found: Song, wanted: GeminiSong): boolean {
  const a = loose(canonicalArtist(found.artist));
  const b = loose(canonicalArtist(wanted.artist));
  const t1 = loose(found.title);
  const t2 = loose(wanted.title);
  const artistOk = a.includes(b) || b.includes(a);
  const titleOk = t1.startsWith(t2) || t2.startsWith(t1);
  return artistOk && titleOk;
}

/** Geminiが挙げた曲を iTunes で探し、見つかった正式な曲データに置き換える（見つからなければ捨てる） */
async function verify(picks: GeminiSong[]): Promise<Song[]> {
  const songs: Song[] = [];
  // iTunes検索は1分あたりの回数に上限があるため、順番に少しずつ調べる
  for (const pick of picks) {
    const results = await searchItunes(`${pick.title} ${pick.artist}`, 5).catch(() => []);
    const hit = results.find((s) => sameSong(s, pick));
    if (hit) songs.push({ ...hit, aiReason: pick.reason || "AIのおすすめ" });
  }
  return songs;
}

/** ホストの端末から呼ぶ。ルームの条件と持ち込まれた曲をもとに、実在する曲だけを返す */
export async function requestGeminiPicks(room: Room, candidates: CandidateEntry[]): Promise<Song[]> {
  const brought = candidates.filter((c) => c.source !== "ai");
  // すでにルームにある曲（AIが前に選んだ曲も含む）は、もう一度選ばせない
  const unique = new Map(candidates.map((c) => [normalizeKey(c.song), c.song]));
  const songRef = (s: Song) => ({ title: s.title, artist: s.artist });
  const liked = [...brought]
    .sort((a, b) => b.weight - a.weight)
    .map((c) => c.song)
    .filter((s, i, list) => list.findIndex((x) => normalizeKey(x) === normalizeKey(s)) === i)
    .slice(0, 20);

  const c = room.conditions;
  const { songs } = await invokeEdgeFunction<{ songs: GeminiSong[] }>("recommend", {
    roomId: room.id,
    conditions: {
      genders: labelsOf(c.genders, GENDERS),
      genres: labelsOf(c.genres, GENRES),
      nationalities: labelsOf(c.nationalities, NATIONALITIES),
      ageGroups: labelsOf(c.ageGroups, AGE_GROUPS),
      other: c.other,
    },
    likedSongs: liked.map(songRef),
    exclude: [...unique.values()].slice(0, 60).map(songRef),
  });

  const verified = await verify(songs ?? []);
  return verified.filter((s, i, list) => !unique.has(normalizeKey(s)) && list.findIndex((x) => normalizeKey(x) === normalizeKey(s)) === i);
}
