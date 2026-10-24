import type { Song } from "@/types";

export interface SongQuery {
  title: string;
  artist?: string;
}

/**
 * 公開楽曲データ（カタログ・検索）の取得層の共通インターフェース。
 * 呼び出し側（lib/logic/*・画面）はこのインターフェースだけに依存し、
 * モック（mock.ts）や MusicBrainz（musicbrainz.ts）の違いを意識しない。
 * 個人の再生データ（知ってる曲）は Spotify（spotify.ts）から別途取り込む。
 */
export interface MusicSourceAdapter {
  /** レコメンドの母集団となるカタログ */
  getAllSongs(): Promise<Song[]>;
  /** 曲名（＋アーティスト名）での検索 */
  searchSongs(query: SongQuery): Promise<Song[]>;
}
