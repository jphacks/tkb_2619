// musicconnect のドメイン型

/** 利用シーン（議事録: カラオケ×世代 / パーティー×国籍 / ドライブ×ジャンル） */
export type Scene = "karaoke" | "party" | "drive";

export const SCENES: { id: Scene; label: string; gap: string; otherPlaceholder: string }[] = [
  { id: "karaoke", label: "カラオケ", gap: "世代のギャップ", otherPlaceholder: "みんなで歌える、明るい曲がいい" },
  { id: "party", label: "パーティー", gap: "国籍のギャップ", otherPlaceholder: "盛り上がる曲。定番すぎない曲も入れたい" },
  { id: "drive", label: "ドライブ", gap: "ジャンルのギャップ", otherPlaceholder: "夜のドライブで流せる、落ち着いた曲" },
];

export type Generation = "teens" | "20s" | "30s" | "40s" | "50s" | "60plus";

export type Nationality = "JP" | "US" | "KR" | "CN" | "OTHER";

export const NATIONALITIES: { id: Nationality; label: string }[] = [
  { id: "JP", label: "日本" },
  { id: "US", label: "アメリカ" },
  { id: "KR", label: "韓国" },
  { id: "CN", label: "中国" },
  { id: "OTHER", label: "その他" },
];

export type Genre =
  | "jpop"
  | "rock"
  | "anime"
  | "kpop"
  | "pop"
  | "hiphop"
  | "edm"
  | "citypop"
  | "enka"
  | "jazz"
  | "classical"
  | "other";

export const GENRES: { id: Genre; label: string }[] = [
  { id: "jpop", label: "J-POP" },
  { id: "rock", label: "ロック" },
  { id: "anime", label: "アニソン" },
  { id: "kpop", label: "K-POP" },
  { id: "pop", label: "海外ポップ" },
  { id: "hiphop", label: "ヒップホップ" },
  { id: "edm", label: "EDM" },
  { id: "citypop", label: "シティポップ" },
  { id: "enka", label: "演歌" },
  { id: "jazz", label: "ジャズ" },
  { id: "classical", label: "クラシック" },
  { id: "other", label: "その他" },
];

/** ルーム作成画面の「年代」 */
export type AgeGroup = "10-20" | "20-30" | "40-50" | "60+";

export const AGE_GROUPS: { id: AgeGroup; label: string; generations: Generation[] }[] = [
  { id: "10-20", label: "10〜20代", generations: ["teens", "20s"] },
  { id: "20-30", label: "20〜30代", generations: ["20s", "30s"] },
  { id: "40-50", label: "40〜50代", generations: ["40s", "50s"] },
  { id: "60+", label: "60代以上", generations: ["60plus"] },
];

/** ルーム作成画面の「性別」（歌う人に合うボーカルの曲を優先する） */
export type GenderPref = "male" | "female" | "mixed";

export const GENDER_PREFS: { id: GenderPref; label: string }[] = [
  { id: "male", label: "男性" },
  { id: "female", label: "女性" },
  { id: "mixed", label: "男女混合" },
];

/** 曲の雰囲気タグ（「その他」の自由入力と照合する） */
export type Mood = "upbeat" | "singalong" | "romantic" | "chill" | "emotional" | "nostalgic" | "summer";

export type SongOrigin = "catalog" | "spotify" | "musicbrainz";

/** 楽曲（Spotify / MusicBrainz / カタログの違いを吸収した形） */
export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  year: number;
  generationTags: Generation[];
  nationalityTags: Nationality[];
  colorFrom: string;
  colorTo: string;
  origin: SongOrigin;
  artworkUrl?: string;
  spotifyId?: string;
  /** 人気度の目安（0〜100）。パーティーで「定番すぎない曲」を混ぜるのに使う */
  popularity?: number;
  moods?: Mood[];
  vocal?: GenderPref;
  /** MusicBrainzからジャンル・国を補完する必要があるか */
  metaStatus?: "pending" | "done";
  mbArtistId?: string;
}

/** AIレコメンドの条件（"any" は指定なし） */
export interface RoomConditions {
  gender: GenderPref | "any";
  genre: Genre | "any";
  nationality: Nationality | "any";
  ageGroup: AgeGroup | "any";
  other: string;
}

export interface Room {
  id: string;
  scene: Scene;
  aiEnabled: boolean;
  conditions: RoomConditions;
  hostMemberId: string | null;
  /** 曲を流す人が最後に選んだ曲 */
  finalSongId: string | null;
  createdAt: string;
}

export interface Member {
  id: string;
  roomId: string;
  name: string;
  kind: "spotify" | "guest";
  joinedAt: string;
}

/** 候補への登録1件（同じ曲を複数人が登録すると複数行になる） */
export interface CandidateEntry {
  roomId: string;
  memberId: string;
  songId: string;
  song: Song;
  source: "spotify" | "manual";
  /** Spotifyの「過去1ヶ月によく聴いた順位」から求めた重み（0〜1）。手動追加は0 */
  weight: number;
  addedAt: string;
}

/** 0: 今は違う / 1: うーん / 2: Better / 3: Best / null: 知らない・スキップ */
export type VoteScore = 0 | 1 | 2 | 3;

export interface VoteEntry {
  roomId: string;
  memberId: string;
  songId: string;
  score: VoteScore | null;
  updatedAt: string;
}

export interface RoomSnapshot {
  room: Room;
  members: Member[];
  candidates: CandidateEntry[];
  votes: VoteEntry[];
}

/** スワイプ方向 → 点数（議事録: 上がbest、右がgood、下がうーん、左がbad） */
export type SwipeDirection = "up" | "right" | "down" | "left";

export const SWIPE_SCORES: Record<SwipeDirection, { score: VoteScore; label: string }> = {
  up: { score: 3, label: "Best" },
  right: { score: 2, label: "Better" },
  down: { score: 1, label: "うーん" },
  left: { score: 0, label: "今は違う" },
};

export const SCORE_LABELS: Record<VoteScore, string> = {
  0: "今は違う",
  1: "うーん",
  2: "Better",
  3: "Best",
};
