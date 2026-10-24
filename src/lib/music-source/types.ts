import type { Song } from "@/types";

/**
 * 楽曲データ取得層の共通インターフェース。
 * まずはモック実装 (mock.ts) で全機能を動かし、将来 Spotify Web API (spotify.ts) や
 * MusicBrainz API (musicbrainz.ts) に差し替えても呼び出し側のロジックは変更不要にする。
 */
export interface MusicSourceAdapter {
  /** カタログ全体を取得する（モックでは静的データ、本番では検索/プレイリストAPIの集約結果などを想定） */
  getAllSongs(): Promise<Song[]>;
  /** タイトル・アーティスト名でのキーワード検索 */
  searchSongs(query: string): Promise<Song[]>;
  /** IDで1曲取得 */
  getSongById(id: string): Promise<Song | undefined>;
}
