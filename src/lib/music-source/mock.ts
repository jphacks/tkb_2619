import type { Song } from "@/types";
import type { MusicSourceAdapter } from "./types";

/**
 * モック楽曲カタログ。
 * 世代(generationTags)・国籍(nationalityTags)はレコメンド用の簡易メタデータで、
 * 実際の人気傾向を厳密に調査したものではない（ハッカソンMVP用の仮データ）。
 */
const MOCK_SONGS: Song[] = [
  { id: "s01", title: "空も飛べるはず", artist: "スピッツ", genre: "rock", year: 1994, generationTags: ["40s", "50plus"], nationalityTags: ["JP"], colorFrom: "#f97316", colorTo: "#fb923c" },
  { id: "s02", title: "TSUNAMI", artist: "サザンオールスターズ", genre: "jpop", year: 2000, generationTags: ["40s", "50plus"], nationalityTags: ["JP"], colorFrom: "#0ea5e9", colorTo: "#38bdf8" },
  { id: "s03", title: "Lemon", artist: "米津玄師", genre: "jpop", year: 2018, generationTags: ["teens", "20s", "30s"], nationalityTags: ["JP"], colorFrom: "#eab308", colorTo: "#facc15" },
  { id: "s04", title: "Pretender", artist: "Official髭男dism", genre: "jpop", year: 2019, generationTags: ["teens", "20s", "30s"], nationalityTags: ["JP"], colorFrom: "#8b5cf6", colorTo: "#a78bfa" },
  { id: "s05", title: "マリーゴールド", artist: "あいみょん", genre: "jpop", year: 2018, generationTags: ["teens", "20s", "30s"], nationalityTags: ["JP"], colorFrom: "#f59e0b", colorTo: "#fbbf24" },
  { id: "s06", title: "怪物", artist: "YOASOBI", genre: "anime", year: 2023, generationTags: ["teens", "20s"], nationalityTags: ["JP"], colorFrom: "#6366f1", colorTo: "#818cf8" },
  { id: "s07", title: "アイドル", artist: "YOASOBI", genre: "anime", year: 2023, generationTags: ["teens", "20s"], nationalityTags: ["JP", "OTHER"], colorFrom: "#ec4899", colorTo: "#f472b6" },
  { id: "s08", title: "炎", artist: "LiSA", genre: "anime", year: 2020, generationTags: ["teens", "20s", "30s"], nationalityTags: ["JP"], colorFrom: "#ef4444", colorTo: "#f87171" },
  { id: "s09", title: "紅蓮華", artist: "LiSA", genre: "anime", year: 2019, generationTags: ["teens", "20s", "30s"], nationalityTags: ["JP", "OTHER"], colorFrom: "#dc2626", colorTo: "#ef4444" },
  { id: "s10", title: "Dynamite", artist: "BTS", genre: "kpop", year: 2020, generationTags: ["teens", "20s"], nationalityTags: ["KR", "US", "OTHER"], colorFrom: "#f43f5e", colorTo: "#fb7185" },
  { id: "s11", title: "How You Like That", artist: "BLACKPINK", genre: "kpop", year: 2020, generationTags: ["teens", "20s"], nationalityTags: ["KR", "OTHER"], colorFrom: "#d946ef", colorTo: "#e879f9" },
  { id: "s12", title: "Antifragile", artist: "LE SSERAFIM", genre: "kpop", year: 2022, generationTags: ["teens", "20s"], nationalityTags: ["KR"], colorFrom: "#06b6d4", colorTo: "#22d3ee" },
  { id: "s13", title: "Shape of You", artist: "Ed Sheeran", genre: "edm", year: 2017, generationTags: ["20s", "30s"], nationalityTags: ["US", "OTHER"], colorFrom: "#14b8a6", colorTo: "#2dd4bf" },
  { id: "s14", title: "Blinding Lights", artist: "The Weeknd", genre: "edm", year: 2020, generationTags: ["teens", "20s", "30s"], nationalityTags: ["US", "OTHER"], colorFrom: "#4f46e5", colorTo: "#6366f1" },
  { id: "s15", title: "Levitating", artist: "Dua Lipa", genre: "edm", year: 2020, generationTags: ["teens", "20s"], nationalityTags: ["US", "OTHER"], colorFrom: "#f97316", colorTo: "#fdba74" },
  { id: "s16", title: "Sweet Child O' Mine", artist: "Guns N' Roses", genre: "rock", year: 1987, generationTags: ["40s", "50plus"], nationalityTags: ["US"], colorFrom: "#78350f", colorTo: "#b45309" },
  { id: "s17", title: "Bohemian Rhapsody", artist: "Queen", genre: "rock", year: 1975, generationTags: ["40s", "50plus"], nationalityTags: ["US", "OTHER"], colorFrom: "#1e293b", colorTo: "#475569" },
  { id: "s18", title: "Billie Jean", artist: "Michael Jackson", genre: "rock", year: 1982, generationTags: ["40s", "50plus"], nationalityTags: ["US", "OTHER"], colorFrom: "#111827", colorTo: "#374151" },
  { id: "s19", title: "プラスティック・ラブ", artist: "竹内まりや", genre: "citypop", year: 1984, generationTags: ["30s", "40s", "50plus"], nationalityTags: ["JP", "OTHER"], colorFrom: "#fb7185", colorTo: "#fda4af" },
  { id: "s20", title: "真夜中のドア", artist: "松原みき", genre: "citypop", year: 1979, generationTags: ["40s", "50plus"], nationalityTags: ["JP", "OTHER"], colorFrom: "#7c3aed", colorTo: "#a78bfa" },
  { id: "s21", title: "A Night in Tunisia", artist: "Dizzy Gillespie", genre: "jazz", year: 1942, generationTags: ["50plus"], nationalityTags: ["US"], colorFrom: "#92400e", colorTo: "#b45309" },
  { id: "s22", title: "Take Five", artist: "The Dave Brubeck Quartet", genre: "jazz", year: 1959, generationTags: ["50plus"], nationalityTags: ["US"], colorFrom: "#0f766e", colorTo: "#14b8a6" },
  { id: "s23", title: "夜明けのスキャット", artist: "由紀さおり", genre: "enka", year: 1969, generationTags: ["50plus"], nationalityTags: ["JP"], colorFrom: "#be185d", colorTo: "#ec4899" },
  { id: "s24", title: "川の流れのように", artist: "美空ひばり", genre: "enka", year: 1989, generationTags: ["40s", "50plus"], nationalityTags: ["JP"], colorFrom: "#334155", colorTo: "#64748b" },
  { id: "s25", title: "DA PUMP U.S.A.", artist: "DA PUMP", genre: "jpop", year: 2018, generationTags: ["20s", "30s", "40s"], nationalityTags: ["JP"], colorFrom: "#16a34a", colorTo: "#4ade80" },
  { id: "s26", title: "新時代", artist: "Ado", genre: "anime", year: 2022, generationTags: ["teens", "20s"], nationalityTags: ["JP", "OTHER"], colorFrom: "#9333ea", colorTo: "#c084fc" },
  { id: "s27", title: "Dynamite Boy", artist: "Stray Kids", genre: "kpop", year: 2021, generationTags: ["teens", "20s"], nationalityTags: ["KR"], colorFrom: "#2563eb", colorTo: "#60a5fa" },
  { id: "s28", title: "夜に駆ける", artist: "YOASOBI", genre: "anime", year: 2019, generationTags: ["teens", "20s", "30s"], nationalityTags: ["JP"], colorFrom: "#1d4ed8", colorTo: "#3b82f6" },
];

function normalizeKey(song: Pick<Song, "title" | "artist">): string {
  // TODO: 現状は「タイトル＋アーティスト名の完全一致」で重複判定している。
  // 将来はジャンル/アーティスト単位の緩い一致（表記揺れ・カバー曲の同一視など）にも対応したい。
  return `${song.title.trim().toLowerCase()}__${song.artist.trim().toLowerCase()}`;
}

export const mockMusicSource: MusicSourceAdapter = {
  async getAllSongs() {
    return MOCK_SONGS;
  },
  async searchSongs(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return MOCK_SONGS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    );
  },
  async getSongById(id: string) {
    return MOCK_SONGS.find((s) => s.id === id);
  },
};

export { MOCK_SONGS, normalizeKey };
