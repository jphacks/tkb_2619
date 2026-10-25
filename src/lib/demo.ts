import type { AiPick, RoomSnapshot, Song, VoteScore } from "@/types";
import { CATALOG, normalizeKey } from "@/lib/music-source";
import { searchItunes } from "@/lib/music-source/itunes";
import { roomBackend } from "@/lib/room";
import { recommendForRoom } from "@/lib/logic/recommend";
import { buildCandidatePool, voteDeck } from "@/lib/logic/ranking";

/**
 * デモ用の参加者（発表でスマホが少なくても「8人が参加中」の状態を作る）。
 * 各人の曲は「Spotifyで過去1ヶ月によく聴いた曲」の代わり（上から順によく聴いた想定）。
 */
/**
 * デモ動画で投票の最初に出す2曲（発表の流れを毎回同じにするため）。
 * 1曲目は「染谷部長が聴いてる」曲、2曲目は「AIレコメンド」の曲。どちらもほかの参加者は持ち込まない。
 */
const DEMO_LISTENER = "染谷部長";
const DEMO_FIRST_SONG = "好きすぎて滅!";
const DEMO_AI_SONG = "もう恋なんてしない";

const PERSONAS: { name: string; songs: string[] }[] = [
  { name: DEMO_LISTENER, songs: ["好きすぎて滅!", "RIDE ON TIME", "プラスティック・ラブ", "TSUNAMI", "真夏の果実", "川の流れのように", "チェリー", "Bohemian Rhapsody", "Billie Jean"] },
  { name: "先輩（30代）", songs: ["Pretender", "Lemon", "白日", "天体観測", "小さな恋のうた", "チェリー", "新宝島", "恋"] },
  { name: "後輩（20代）", songs: ["怪獣の花唄", "夜に駆ける", "アイドル", "青と夏", "ケセラセラ", "マリーゴールド", "Subtitle", "Lemon"] },
  { name: "Alex（留学生）", songs: ["Blinding Lights", "Shape of You", "Uptown Funk", "Levitating", "Happy", "Dynamite", "Bohemian Rhapsody", "夜に駆ける"] },
  { name: "ミナ（韓国）", songs: ["Dynamite", "Hype Boy", "TT", "How You Like That", "アイドル", "Butter", "新時代", "怪獣の花唄"] },
];

function songByTitle(title: string): Song {
  const song = CATALOG.find((s) => s.title === title);
  if (!song) throw new Error(`デモ用の曲がカタログにありません: ${title}`);
  return song;
}

/** デモの2曲は新しい曲もあり MusicBrainz にジャケットがないため、iTunes のジャケットを付けておく */
async function withArtwork(song: Song): Promise<Song> {
  try {
    const hit = (await searchItunes(`${song.title} ${song.artist}`, 5)).find((s) => normalizeKey(s) === normalizeKey(song));
    return hit?.artworkUrl ? { ...song, artworkUrl: hit.artworkUrl } : song;
  } catch {
    return song;
  }
}

/** 決まった結果になるよう、名前と曲から 0〜1 の擬似乱数を作る */
function pseudoRandom(seed: string): number {
  let hash = 0;
  for (const ch of seed) hash = (hash * 33 + ch.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 1000) / 1000;
}

export async function addDemoMembers(roomId: string): Promise<void> {
  const memberIds: { id: string; songs: Song[] }[] = [];
  for (const persona of PERSONAS) {
    const member = await roomBackend.joinRoom(roomId, { name: persona.name, kind: "spotify" });
    const songs = await Promise.all(
      persona.songs.map((title) => (title === DEMO_FIRST_SONG ? withArtwork(songByTitle(title)) : songByTitle(title)))
    );
    await roomBackend.addCandidates(
      songs.map((song, rank) => ({
        roomId,
        memberId: member.id,
        songId: song.id,
        song,
        source: "spotify" as const,
        weight: (songs.length - rank) / songs.length,
      }))
    );
    memberIds.push({ id: member.id, songs });
  }

  // 2曲目に出す曲を、AIのおすすめの先頭に入れておく
  const before = await roomBackend.fetchSnapshot(roomId);
  if (before) {
    const aiSong = await withArtwork(songByTitle(DEMO_AI_SONG));
    const pick: AiPick = { song: aiSong, reason: "世代を問わず、みんなで口ずさめる定番曲" };
    const rest = before.room.aiPicks.filter((p) => normalizeKey(p.song) !== normalizeKey(aiSong));
    await roomBackend.setAiPicks(roomId, [pick, ...rest]);
  }

  // 追加後の投票デッキに対して、各人の好みに沿った投票をする
  const snapshot = await roomBackend.fetchSnapshot(roomId);
  if (!snapshot) return;
  const pool = buildCandidatePool(snapshot, recommendForRoom(snapshot.room, snapshot.candidates, CATALOG));
  for (const { id, songs } of memberIds) {
    const own = new Set(songs.map(normalizeKey));
    const genres = new Set(songs.map((s) => s.genre));
    for (const item of voteDeck(pool)) {
      const r = pseudoRandom(id.slice(0, 8) + item.key);
      const score: VoteScore = own.has(item.key) ? (r < 0.7 ? 3 : 2) : genres.has(item.song.genre) ? (r < 0.5 ? 2 : 1) : r < 0.3 ? 1 : 0;
      await roomBackend.setVote(roomId, id, item.song.id, score);
    }
  }
}

/** デモ用の参加者がいるルームでは、投票の最初にデモ用の2曲を出す（その曲のキーを順に返す） */
export function demoDeckOrder(snapshot: RoomSnapshot): string[] {
  if (!snapshot.members.some((m) => m.name === DEMO_LISTENER && m.kind === "spotify")) return [];
  return [DEMO_FIRST_SONG, DEMO_AI_SONG].map((title) => normalizeKey(songByTitle(title)));
}
