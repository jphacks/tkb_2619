import type { Song } from "@/types";
import type { MusicSourceAdapter } from "./types";

/**
 * Spotify Web API アダプター（未実装・設計メモのみ）。
 *
 * TODO(spotify-oauth): Authorization Code with PKCE フローを想定。
 *   1. `.env.local` に NEXT_PUBLIC_SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET /
 *      SPOTIFY_REDIRECT_URI を追加（シークレットはサーバー側のみで使用し、
 *      クライアントに渡さない）。
 *   2. /api/auth/spotify/login でcode_verifier/code_challengeを生成しSpotify認可画面へリダイレクト。
 *   3. /api/auth/spotify/callback でトークン交換、httpOnly cookieにrefresh_tokenを保存。
 *   4. 本アダプターはサーバーコンポーネント/Route Handler経由でアクセストークンを取得し、
 *      `GET /v1/search`, `GET /v1/me/tracks`, `GET /v1/me/top/tracks` 等を呼び出して
 *      Song型に正規化する（title=name, artist=artists[0].name, genre推定はartistsのgenres等）。
 *   5. 参加者の「知ってる曲」は Spotifyの再生履歴/プレイリストから抽出する想定
 *      （現状はモックの knownSongIds 選択式で代替）。
 */
export const spotifyMusicSource: MusicSourceAdapter = {
  async getAllSongs(): Promise<Song[]> {
    throw new Error("Spotify連携は未実装です。lib/music-source/mock.ts を利用してください。");
  },
  async searchSongs(): Promise<Song[]> {
    throw new Error("Spotify連携は未実装です。lib/music-source/mock.ts を利用してください。");
  },
  async getSongById(): Promise<Song | undefined> {
    throw new Error("Spotify連携は未実装です。lib/music-source/mock.ts を利用してください。");
  },
};
