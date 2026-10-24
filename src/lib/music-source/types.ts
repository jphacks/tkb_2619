import type { Song } from "@/types";

/**
 * 公開楽曲データ（カタログ・検索）の取得層。画面やロジックはこのインターフェースだけに依存する。
 * 個人の再生データ（過去1ヶ月によく聴いた曲）は Spotify（spotify.ts）から別途取り込む。
 */
export interface MusicSourceAdapter {
  /** AIレコメンドの母集団となるカタログ */
  getCatalog(): Song[];
  /** 曲名・アーティスト名での検索（1つの入力欄、順不同） */
  searchSongs(query: string, knownArtists?: Set<string>): Promise<Song[]>;
}
