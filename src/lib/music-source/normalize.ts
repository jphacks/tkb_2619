import { NATIONALITIES } from "@/types";
import type { Generation, Genre, Nationality, Song } from "@/types";

/** Spotify等が英語表記で返す日本のアーティスト名を、カタログの表記に寄せる */
const ARTIST_ALIASES: Record<string, string> = {
  "kenshi yonezu": "米津玄師",
  "official hige dandism": "Official髭男dism",
  spitz: "スピッツ",
  aimyon: "あいみょん",
  yorushika: "ヨルシカ",
  sakanaction: "サカナクション",
  "southern all stars": "サザンオールスターズ",
  "mariya takeuchi": "竹内まりや",
  "tatsuro yamashita": "山下達郎",
  "miki matsubara": "松原みき",
  "hibari misora": "美空ひばり",
  "sayuri ishikawa": "石川さゆり",
  "gen hoshino": "星野源",
  "hikaru utada": "宇多田ヒカル",
  "miyuki nakajima": "中島みゆき",
  "yoko takahashi": "高橋洋子",
  remioromen: "レミオロメン",
  "jay chou": "周杰伦",
  "eason chan": "陈奕迅",
};

export function canonicalArtist(artist: string): string {
  const trimmed = artist.trim();
  return ARTIST_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * 曲が「被っている」かの判定キー（議事録の仮決定: タイトル＋アーティスト名の一致）。
 * アーティスト名は英語表記→日本語表記の別名を吸収している。
 * 未対応: 曲名の表記揺れ（Idol / アイドル）や、ジャンル/アーティスト単位の緩い一致には未対応。
 */
export function normalizeKey(song: Pick<Song, "title" | "artist">): string {
  return `${song.title.trim().toLowerCase()}__${canonicalArtist(song.artist).toLowerCase()}`;
}

/** 表記ゆれ（大文字小文字・空白・記号）を無視して比べるための文字列 */
export function looseText(text: string): string {
  return text.toLowerCase().replace(/[\s'’"“”.,!?！？・\-–—()（）[\]［］【】]/g, "");
}

// 上から順に判定する（"city pop" を "pop" より先に見るなど、順序に意味がある）
const GENRE_RULES: { genre: Genre; keywords: string[] }[] = [
  { genre: "citypop", keywords: ["city pop"] },
  { genre: "jpop", keywords: ["j-pop", "jpop", "j-rock", "kayōkyoku", "kayokyoku"] },
  { genre: "kpop", keywords: ["k-pop", "kpop"] },
  { genre: "anime", keywords: ["anime", "anison", "vocaloid", "video game"] },
  { genre: "enka", keywords: ["enka"] },
  { genre: "jazz", keywords: ["jazz"] },
  { genre: "classical", keywords: ["classical", "baroque", "romantic era", "opera"] },
  { genre: "hiphop", keywords: ["hip hop", "hip-hop", "rap", "trap"] },
  { genre: "edm", keywords: ["edm", "electronic", "electro", "house", "techno", "dance", "trance", "dubstep"] },
  { genre: "rock", keywords: ["rock", "metal", "punk", "grunge", "alternative"] },
  { genre: "pop", keywords: ["pop"] },
];

/** MusicBrainzのタグ（多い順）を、アプリ内の大まかなジャンルに寄せる */
export function mapTagsToGenre(tags: string[], nationality?: Nationality): Genre {
  for (const tag of tags) {
    const t = tag.toLowerCase();
    const rule = GENRE_RULES.find((r) => r.keywords.some((k) => t.includes(k)));
    if (!rule) continue;
    if (rule.genre === "pop" && nationality === "JP") return "jpop";
    if (rule.genre === "pop" && nationality === "KR") return "kpop";
    return rule.genre;
  }
  return "other";
}

/** MusicBrainzの国コード（ISO 3166-1）をアプリの国籍区分に寄せる */
export function mapCountryToNationality(country?: string): Nationality | undefined {
  if (!country) return undefined;
  const known = NATIONALITIES.find((n) => n.id === country && n.id !== "OTHER");
  return known ? known.id : "OTHER";
}

const GENERATION_AGE_RANGES: { id: Generation; min: number; max: number }[] = [
  { id: "teens", min: 10, max: 19 },
  { id: "20s", min: 20, max: 29 },
  { id: "30s", min: 30, max: 39 },
  { id: "40s", min: 40, max: 49 },
  { id: "50s", min: 50, max: 59 },
  { id: "60plus", min: 60, max: 90 },
];

/**
 * 発売年から「この曲を青春時代に聴いていた世代」を推定する簡易ヒューリスティック。
 * 発売当時12〜22歳だった人の現在の年齢帯と、直近3年の曲は10代・20代にも割り当てる。
 * 今後: 実際の世代別の認知度データ（チャート等）に置き換えたい。
 */
export function generationsForYear(year: number, now = new Date().getFullYear()): Generation[] {
  if (!Number.isFinite(year) || year <= 0) return [];
  const minAge = now - year + 12;
  const maxAge = now - year + 22;
  const result = GENERATION_AGE_RANGES.filter((g) => g.max >= minAge && g.min <= maxAge).map((g) => g.id);
  if (now - year <= 3) {
    for (const g of ["teens", "20s"] as const) if (!result.includes(g)) result.push(g);
  }
  return result;
}

const PALETTE: [string, string][] = [
  ["#f97316", "#fb923c"],
  ["#0ea5e9", "#38bdf8"],
  ["#8b5cf6", "#a78bfa"],
  ["#ec4899", "#f472b6"],
  ["#ef4444", "#f87171"],
  ["#14b8a6", "#2dd4bf"],
  ["#6366f1", "#818cf8"],
  ["#16a34a", "#4ade80"],
  ["#d946ef", "#e879f9"],
  ["#eab308", "#facc15"],
  ["#334155", "#64748b"],
  ["#0f766e", "#14b8a6"],
];

/** IDから決まった色を選ぶ（ジャケット画像の代わり） */
export function colorsForId(id: string): { colorFrom: string; colorTo: string } {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const [colorFrom, colorTo] = PALETTE[Math.abs(hash) % PALETTE.length];
  return { colorFrom, colorTo };
}

/** "2018-03-14" / "2018" などから年を取り出す */
export function parseYear(date?: string): number {
  const year = Number.parseInt(date?.slice(0, 4) ?? "", 10);
  return Number.isFinite(year) ? year : 0;
}
