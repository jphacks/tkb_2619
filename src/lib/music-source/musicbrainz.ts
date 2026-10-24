import type { Song } from "@/types";
import type { MusicSourceAdapter } from "./types";

/**
 * MusicBrainz API アダプター（未実装・設計メモのみ）。
 *
 * Spotifyはパブリック楽曲データ（ジャンル/メタデータ）の取得に認可が必要なため、
 * 認可不要で曲・アーティストのメタデータを補完したい場合の代替/併用ソースとして
 * MusicBrainz (https://musicbrainz.org/doc/MusicBrainz_API) への差し替えを想定している。
 *
 * TODO(musicbrainz): `GET /ws/2/recording?query=...&fmt=json` で曲検索、
 *   `GET /ws/2/artist/{id}?inc=genres` 等でジャンル情報を取得しSong型へ正規化する。
 *   User-Agentヘッダーの設定とレート制限（1req/sec目安）に注意。
 */
export const musicBrainzMusicSource: MusicSourceAdapter = {
  async getAllSongs(): Promise<Song[]> {
    throw new Error("MusicBrainz連携は未実装です。lib/music-source/mock.ts を利用してください。");
  },
  async searchSongs(): Promise<Song[]> {
    throw new Error("MusicBrainz連携は未実装です。lib/music-source/mock.ts を利用してください。");
  },
  async getSongById(): Promise<Song | undefined> {
    throw new Error("MusicBrainz連携は未実装です。lib/music-source/mock.ts を利用してください。");
  },
};
