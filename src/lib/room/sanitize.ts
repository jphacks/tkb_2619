import {
  AGE_GROUPS,
  GENDERS,
  GENRES,
  LEGACY_AGE_GROUPS,
  NATIONALITIES,
  type AiPick,
  type Generation,
  type Mood,
  type RoomConditions,
  type Song,
  type SongOrigin,
} from "@/types";
import { colorsForId } from "@/lib/music-source/normalize";

/**
 * データベースから読んだ曲データの検査。
 * ルームのデータは公開鍵で誰でも書き込めるため、壊れた値や悪意のある値（文字列でない曲名、
 * 外部サーバーを指す画像URL、CSSに埋め込まれる色など）がそのまま画面に流れないよう、
 * 読み込み時に形をそろえ、使えない値は捨てる。
 */

const MAX_TEXT = 200;

const GENDER_IDS = new Set<string>(GENDERS.map((g) => g.id));
const GENRE_IDS = new Set<string>(GENRES.map((g) => g.id));
const NATIONALITY_IDS = new Set<string>(NATIONALITIES.map((n) => n.id));
const GENERATION_IDS = new Set<string>(AGE_GROUPS.map((a) => a.id));
const MOODS = new Set<string>(["upbeat", "singalong", "romantic", "chill", "emotional", "nostalgic", "summer"] satisfies Mood[]);
const ORIGINS = new Set<string>(["catalog", "spotify", "musicbrainz", "itunes", "ai"] satisfies SongOrigin[]);

/** ジャケット画像を読み込んでよい配信元（Spotify / Apple / Cover Art Archive） */
const ARTWORK_HOSTS = [/(^|\.)scdn\.co$/, /\.spotifycdn\.com$/, /\.mzstatic\.com$/, /^coverartarchive\.org$/];

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const MB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const ROOM_ID = /^[a-z0-9]{10}$/;

/** 招待URLのルームIDとして正しい形か（generateRoomId が作る10文字） */
export function isValidRoomId(roomId: string | null | undefined): roomId is string {
  return typeof roomId === "string" && ROOM_ID.test(roomId);
}

export function cleanText(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** 決められた値だけを残した文字列の配列（重複なし） */
export function pickIds<T extends string>(value: unknown, allowed: Set<string>): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is T => typeof v === "string" && allowed.has(v)))];
}

function artworkUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ARTWORK_HOSTS.some((host) => host.test(url.hostname)) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** 曲データとして使える形にそろえる。曲名・アーティスト名・IDがなければ null */
export function parseSong(raw: unknown): Song | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const id = cleanText(s.id);
  const title = cleanText(s.title);
  const artist = cleanText(s.artist);
  if (!id || !title || !artist) return null;

  const colors =
    typeof s.colorFrom === "string" && typeof s.colorTo === "string" && HEX_COLOR.test(s.colorFrom) && HEX_COLOR.test(s.colorTo)
      ? { colorFrom: s.colorFrom, colorTo: s.colorTo }
      : colorsForId(id);
  const year = typeof s.year === "number" && Number.isInteger(s.year) && s.year >= 0 && s.year <= 3000 ? s.year : 0;
  const genre = typeof s.genre === "string" && GENRE_IDS.has(s.genre) ? (s.genre as Song["genre"]) : "other";
  const origin = typeof s.origin === "string" && ORIGINS.has(s.origin) ? (s.origin as SongOrigin) : "catalog";

  return {
    id,
    title,
    artist,
    genre,
    year,
    generationTags: pickIds<Generation>(s.generationTags, GENERATION_IDS),
    nationalityTags: pickIds(s.nationalityTags, NATIONALITY_IDS),
    ...colors,
    origin,
    artworkUrl: artworkUrl(s.artworkUrl),
    spotifyId: typeof s.spotifyId === "string" && SPOTIFY_ID.test(s.spotifyId) ? s.spotifyId : undefined,
    popularity:
      typeof s.popularity === "number" && s.popularity >= 0 && s.popularity <= 100 ? s.popularity : undefined,
    moods: Array.isArray(s.moods) ? pickIds<Mood>(s.moods, MOODS) : undefined,
    vocal: s.vocal === "male" || s.vocal === "female" || s.vocal === "mixed" ? s.vocal : undefined,
    metaStatus: s.metaStatus === "pending" || s.metaStatus === "done" ? s.metaStatus : undefined,
    mbArtistId: typeof s.mbArtistId === "string" && MB_ID.test(s.mbArtistId) ? s.mbArtistId : undefined,
  };
}

/**
 * 保存されているルームの条件を読み込む。以前のバージョンは単一選択（例: genre: "jpop", 未指定は "any"）で
 * 保存していたため、その形式も複数選択の形に変換する。選択肢にない値は捨てる。
 */
export function parseConditions(raw: unknown): RoomConditions {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (plural: string, singular: string): unknown[] => {
    const value = r[plural] ?? r[singular];
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value !== "any") return value === "mixed" ? ["male", "female"] : [value];
    return [];
  };
  const ageGroups = list("ageGroups", "ageGroup").flatMap((id) => (typeof id === "string" ? (LEGACY_AGE_GROUPS[id] ?? [id]) : []));
  return {
    genders: pickIds(list("genders", "gender"), GENDER_IDS),
    genres: pickIds(list("genres", "genre"), GENRE_IDS),
    nationalities: pickIds(list("nationalities", "nationality"), NATIONALITY_IDS),
    ageGroups: pickIds(ageGroups, GENERATION_IDS),
    other: cleanText(r.other),
  };
}

/** 保存されたAIのおすすめ。形の合わないものは捨てる */
export function parseAiPicks(raw: unknown): AiPick[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    const song = parseSong((p as { song?: unknown } | null)?.song);
    return song ? [{ song, reason: cleanText((p as { reason?: unknown }).reason, 100) }] : [];
  });
}
