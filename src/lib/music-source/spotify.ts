import type { Song } from "@/types";
import { BASE_PATH } from "@/lib/config";
import { canonicalArtist, colorsForId, generationsForYear, normalizeKey, parseYear } from "./normalize";

/**
 * Spotify Web API 連携（参加者の「知ってる曲」の取り込み）。
 *
 * サイトはGitHub Pages（サーバーなし）で配信しているため、Client Secretを使わない
 * Authorization Code with PKCE フローでブラウザだけで完結させる。
 * Client IDはPKCEでは公開されて問題ない値（認可URLにもそのまま載る）なので、既定値をコードに持たせている。
 * アクセストークンは取り込みに一度使うだけで保存しない（共有端末で次の人がログインするため）。
 *
 * Spotifyダッシュボードに登録が必要なRedirect URI:
 *   - https://jphacks.github.io/tkb_2619/callback （公開サイト）
 *   - http://127.0.0.1:3000/callback （ローカル開発。Spotifyは localhost を受け付けない）
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || "135ab4d9cb254a939e6b4909e641e0ca";
const SCOPES = ["user-top-read"];
const PKCE_STORAGE_KEY = "musicconnect-spotify-pkce";

export class SpotifyError extends Error {}

export function getRedirectUri(): string {
  return `${window.location.origin}${BASE_PATH}/callback`;
}

function randomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

async function codeChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** ログイン後にどのルームへ戻るか */
export interface SpotifyLoginContext {
  roomId: string;
}

/** Spotifyのログイン画面へ遷移する。localhostで開いている場合は 127.0.0.1 に移動するだけで終わる */
export async function startSpotifyLogin(
  context: SpotifyLoginContext
): Promise<"redirected-to-loopback" | "redirected-to-spotify"> {
  if (window.location.hostname === "localhost") {
    window.location.href = window.location.href.replace("//localhost", "//127.0.0.1");
    return "redirected-to-loopback";
  }

  const verifier = randomString(64);
  const state = randomString(16);
  sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify({ verifier, state, context }));

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SCOPES.join(" "),
    code_challenge_method: "S256",
    code_challenge: await codeChallengeFor(verifier),
    state,
    // 同じ端末で次の参加者が別アカウントに切り替えられるよう、毎回確認画面を出す
    show_dialog: "true",
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
  return "redirected-to-spotify";
}

/** /callback で受け取った認可コードをアクセストークンに交換する */
export async function exchangeCodeForToken(
  code: string,
  state: string | null
): Promise<{ token: string; context: SpotifyLoginContext }> {
  const saved = sessionStorage.getItem(PKCE_STORAGE_KEY);
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
  const { verifier, state: expectedState, context } = saved
    ? (JSON.parse(saved) as { verifier?: string; state?: string; context?: SpotifyLoginContext })
    : {};
  if (!verifier || !context || state !== expectedState) {
    throw new SpotifyError("ログイン情報の確認に失敗しました。もう一度「Spotifyで参加」からやり直してください。");
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new SpotifyError(`Spotifyのトークン取得に失敗しました（${res.status}）`);
  const data = (await res.json()) as { access_token: string };
  return { token: data.access_token, context };
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { release_date?: string; images?: { url: string; width: number }[] };
}

async function spotifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    // 曲名・アーティスト名を日本語表記で受け取り、日本語のカタログと「被り判定」が一致しやすくする
    // 未対応: 英語表記で返ってきた場合（Idol / アイドル 等）の同一視はMusicBrainzの別名検索で対応したい
    headers: { Authorization: `Bearer ${token}`, "Accept-Language": "ja" },
  });
  if (res.status === 403) {
    throw new SpotifyError(
      "このSpotifyアカウントはアプリの利用者として登録されていません。Spotifyダッシュボードの「User Management」に追加してもらってください。"
    );
  }
  if (!res.ok) throw new SpotifyError(`Spotify APIの呼び出しに失敗しました（${res.status}）`);
  return res.json() as Promise<T>;
}

function trackToSong(track: SpotifyTrack): Song {
  const id = `spotify:${track.id}`;
  const year = parseYear(track.album.release_date);
  const images = [...(track.album.images ?? [])].sort((a, b) => a.width - b.width);
  return {
    id,
    title: track.name,
    artist: canonicalArtist(track.artists[0]?.name ?? "不明なアーティスト"),
    genre: "other",
    year,
    generationTags: generationsForYear(year),
    nationalityTags: [],
    ...colorsForId(id),
    origin: "spotify",
    spotifyId: track.id,
    artworkUrl: (images.find((i) => i.width >= 200) ?? images[images.length - 1])?.url,
    metaStatus: "pending",
  };
}

export interface ListenedSong {
  song: Song;
  /** よく聴いた順位から求めた重み（1位=1.0 → 50位=0.02） */
  weight: number;
}

export interface SpotifyImport {
  displayName: string;
  songs: ListenedSong[];
}

const TOP_LIMIT = 50;

/**
 * 過去1ヶ月によく聴いた曲（Spotifyの short_term ≒ 直近4週間のトップトラック）を取り込む。
 * 議事録では「聴いた回数」でランキング化する案だが、Spotify APIは再生回数を返さないため、
 * 順位から求めた重みで代用している。
 */
export async function importSpotifyLibrary(token: string): Promise<SpotifyImport> {
  const me = await spotifyGet<{ display_name: string | null }>("/me", token);
  const top = await spotifyGet<{ items: SpotifyTrack[] }>(
    `/me/top/tracks?limit=${TOP_LIMIT}&time_range=short_term`,
    token
  );

  const byKey = new Map<string, ListenedSong>();
  top.items.forEach((track, rank) => {
    if (!track?.id) return;
    const song = trackToSong(track);
    const key = normalizeKey(song);
    if (!byKey.has(key)) byKey.set(key, { song, weight: (TOP_LIMIT - rank) / TOP_LIMIT });
  });

  return { displayName: me.display_name || "Spotifyユーザー", songs: Array.from(byKey.values()) };
}

/** Spotifyで曲を開くURL（IDがなければ検索ページ） */
export function spotifyOpenUrl(song: Pick<Song, "title" | "artist" | "spotifyId">): string {
  if (song.spotifyId) return `https://open.spotify.com/track/${song.spotifyId}`;
  return `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`;
}
