import type { Participant } from "@/types";

/**
 * 参加者のプリセット（ペルソナ）。
 * 「参加者設定画面」ではこの中から人数分選択する（モックではユーザー選択式）。
 * knownSongIds は lib/music-source/mock.ts の曲IDに対応し、世代・国籍をまたいだ
 * 「共通曲抽出」のデモが分かりやすくなるようあえて重複を持たせている。
 */
export const MOCK_PARTICIPANTS: Participant[] = [
  {
    id: "p-father",
    name: "お父さん",
    emoji: "👨",
    generation: "50plus",
    nationality: "JP",
    favoriteGenres: ["rock", "citypop", "enka"],
    knownSongIds: ["s01", "s02", "s16", "s17", "s18", "s19", "s20", "s23", "s24"],
  },
  {
    id: "p-mother",
    name: "お母さん",
    emoji: "👩",
    generation: "40s",
    nationality: "JP",
    favoriteGenres: ["jpop", "citypop"],
    knownSongIds: ["s02", "s19", "s20", "s24", "s03", "s04", "s25"],
  },
  {
    id: "p-self",
    name: "自分",
    emoji: "🧑",
    generation: "20s",
    nationality: "JP",
    favoriteGenres: ["jpop", "anime"],
    knownSongIds: ["s03", "s04", "s05", "s06", "s07", "s08", "s09", "s26", "s28"],
  },
  {
    id: "p-sister",
    name: "妹",
    emoji: "👧",
    generation: "teens",
    nationality: "JP",
    favoriteGenres: ["anime", "kpop"],
    knownSongIds: ["s06", "s07", "s08", "s09", "s26", "s28", "s10", "s11", "s12", "s27"],
  },
  {
    id: "p-us-friend",
    name: "アメリカ人の友人",
    emoji: "🇺🇸",
    generation: "20s",
    nationality: "US",
    favoriteGenres: ["edm", "rock"],
    knownSongIds: ["s13", "s14", "s15", "s16", "s17", "s18"],
  },
  {
    id: "p-kr-friend",
    name: "韓国人の友人",
    emoji: "🇰🇷",
    generation: "20s",
    nationality: "KR",
    favoriteGenres: ["kpop"],
    knownSongIds: ["s10", "s11", "s12", "s27", "s07", "s09"],
  },
  {
    id: "p-cn-friend",
    name: "中国人の友人",
    emoji: "🇨🇳",
    generation: "30s",
    nationality: "CN",
    favoriteGenres: ["jpop", "edm"],
    knownSongIds: ["s03", "s04", "s13", "s14", "s15"],
  },
  {
    id: "p-grandpa",
    name: "おじいちゃん",
    emoji: "🧓",
    generation: "50plus",
    nationality: "JP",
    favoriteGenres: ["enka", "jazz"],
    knownSongIds: ["s21", "s22", "s23", "s24", "s17", "s18"],
  },
  {
    id: "p-drive-buddy",
    name: "ドライブ仲間",
    emoji: "🧑‍🦱",
    generation: "30s",
    nationality: "JP",
    favoriteGenres: ["citypop", "rock"],
    knownSongIds: ["s01", "s02", "s19", "s20", "s13", "s14"],
  },
];
