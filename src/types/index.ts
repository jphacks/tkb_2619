// ドメイン型定義
// 「音楽で距離を縮める」アプリの中心となるデータモデル

/** シーン: どの場面で使うか */
export type Scene = "karaoke" | "party" | "drive";

export const SCENES: { id: Scene; label: string; emoji: string; description: string }[] = [
  { id: "karaoke", label: "カラオケ", emoji: "🎤", description: "世代が違っても盛り上がれる曲を見つける" },
  { id: "party", label: "パーティー", emoji: "🎉", description: "国籍や言語が違う参加者で場を盛り上げる曲を見つける" },
  { id: "drive", label: "ドライブ", emoji: "🚗", description: "同乗者の好みに合う曲を見つける" },
];

/** 世代 */
export type Generation = "teens" | "20s" | "30s" | "40s" | "50plus";

export const GENERATIONS: { id: Generation; label: string }[] = [
  { id: "teens", label: "10代" },
  { id: "20s", label: "20代" },
  { id: "30s", label: "30代" },
  { id: "40s", label: "40代" },
  { id: "50plus", label: "50代以上" },
];

/** 国籍（簡易区分） */
export type Nationality = "JP" | "US" | "KR" | "CN" | "OTHER";

export const NATIONALITIES: { id: Nationality; label: string }[] = [
  { id: "JP", label: "日本" },
  { id: "US", label: "アメリカ" },
  { id: "KR", label: "韓国" },
  { id: "CN", label: "中国" },
  { id: "OTHER", label: "その他" },
];

/** 音楽ジャンル */
export type Genre =
  | "jpop"
  | "kpop"
  | "rock"
  | "hiphop"
  | "edm"
  | "jazz"
  | "anime"
  | "citypop"
  | "enka"
  | "classical";

export const GENRES: { id: Genre; label: string }[] = [
  { id: "jpop", label: "J-POP" },
  { id: "kpop", label: "K-POP" },
  { id: "rock", label: "ロック" },
  { id: "hiphop", label: "ヒップホップ" },
  { id: "edm", label: "EDM" },
  { id: "jazz", label: "ジャズ" },
  { id: "anime", label: "アニソン" },
  { id: "citypop", label: "シティポップ" },
  { id: "enka", label: "演歌" },
  { id: "classical", label: "クラシック" },
];

/** 楽曲データ（将来 Spotify / MusicBrainz 等の外部APIに差し替え可能なように正規化） */
export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  year: number;
  /** この曲がよく聴かれる世代（属性レコメンド用のメタデータ、簡易モック） */
  generationTags: Generation[];
  /** この曲がよく聴かれる国籍（属性レコメンド用のメタデータ、簡易モック） */
  nationalityTags: Nationality[];
  /** モック用のジャケット代わりの色（将来 albumArtUrl に置き換え） */
  colorFrom: string;
  colorTo: string;
}

/** 参加者（モックではプリセットの人物から選択する） */
export interface Participant {
  id: string;
  name: string;
  emoji: string;
  generation: Generation;
  nationality: Nationality;
  favoriteGenres: Genre[];
  /** この参加者が「知っている/よく聴く」曲のID一覧 */
  knownSongIds: string[];
}

/** スワイプ方向 */
export type SwipeDirection = "up" | "down" | "left" | "right";

/**
 * スワイプ方向 → 0〜3段階評価 のマッピング
 * 右: 3 (大好き) / 上: 2 (好き) / 左: 1 (知ってる) / 下: 0 (興味ない・知らない)
 * TODO: 評価段階の割当は実装都合で決めた仮仕様。UXテスト次第で調整する。
 */
export const DIRECTION_TO_SCORE: Record<SwipeDirection, 0 | 1 | 2 | 3> = {
  right: 3,
  up: 2,
  left: 1,
  down: 0,
};

export const SCORE_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: "興味ない",
  1: "知ってる",
  2: "好き",
  3: "大好き",
};

/** 投票（1参加者 × 1曲） */
export interface Vote {
  participantId: string;
  songId: string;
  score: 0 | 1 | 2 | 3;
  direction: SwipeDirection;
}

/** 候補曲の出どころ */
export type CandidateSource = "common" | "submitted" | "recommended";

/** 曲候補一覧で扱う単位（楽曲 + メタ情報） */
export interface CandidateSong {
  song: Song;
  source: CandidateSource;
  /** 共通曲抽出: 何人がこの曲を知っているか */
  knownByCount: number;
  /** knownByCount / 参加人数 */
  knownByRatio: number;
  /** 属性レコメンドでのマッチ度（0〜1、該当なしは0） */
  recommendScore: number;
}
