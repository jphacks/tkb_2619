import {
  AGE_GROUPS,
  GENDERS,
  GENRES,
  NATIONALITIES,
  type CandidateEntry,
  type Genre,
  type Mood,
  type Room,
  type Song,
} from "@/types";
import { canonicalArtist, normalizeKey, RELATED_ARTISTS } from "@/lib/music-source";

export interface Recommendation {
  song: Song;
  /** 0〜1 */
  score: number;
  reason: string;
}

/**
 * 「その他」の自由入力を雰囲気タグに変換するキーワード辞書。
 * TODO: 議事録の「文章ベースで候補を選出」は本来LLMで解釈したい。APIキーをブラウザに置けないため、
 * Supabase Edge Function 経由でLLM（Claude等）を呼ぶ形に置き換える。
 */
const MOOD_KEYWORDS: Record<Mood, string[]> = {
  upbeat: ["明るい", "盛り上が", "元気", "ノリ", "アップテンポ", "テンション", "楽しい", "ダンス", "踊"],
  singalong: ["歌える", "みんなで", "合唱", "一緒に", "定番", "有名"],
  romantic: ["ロマンチック", "恋", "デート", "ラブ", "愛", "甘い"],
  chill: ["落ち着", "しっとり", "チル", "静か", "ゆったり", "夜", "癒"],
  emotional: ["泣ける", "感動", "切ない", "エモ", "バラード"],
  nostalgic: ["懐かし", "昔", "青春", "思い出", "レトロ"],
  summer: ["夏", "海", "爽やか", "爽快"],
};

export function moodsFromText(text: string): Mood[] {
  return (Object.keys(MOOD_KEYWORDS) as Mood[]).filter((mood) => MOOD_KEYWORDS[mood].some((k) => text.includes(k)));
}

const genreLabel = (g: Genre) => GENRES.find((x) => x.id === g)?.label ?? g;

/** ルームに集まった曲から「参加者の好み」を作る（ジャンルの比率とよく聴くアーティスト） */
function buildProfile(candidates: CandidateEntry[]) {
  const genreWeight = new Map<Genre, number>();
  const artistWeight = new Map<string, number>();
  let total = 0;
  for (const c of candidates) {
    const w = c.source === "spotify" ? 0.5 + c.weight : 1;
    total += w;
    if (c.song.genre !== "other") genreWeight.set(c.song.genre, (genreWeight.get(c.song.genre) ?? 0) + w);
    const artist = canonicalArtist(c.song.artist);
    artistWeight.set(artist, (artistWeight.get(artist) ?? 0) + w);
  }
  const topGenreWeight = Math.max(0, ...genreWeight.values());
  return {
    genreAffinity: (g: Genre) => (topGenreWeight > 0 ? (genreWeight.get(g) ?? 0) / topGenreWeight : 0),
    artists: [...artistWeight.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a),
    isEmpty: total === 0,
  };
}

/** 条件1項目ぶんの評価。score は集団のうちどれだけをカバーできるか（0〜1） */
interface ConditionCheck {
  score: number;
  label: string | null;
}

const labelsOf = <T extends string>(ids: T[], options: { id: T; label: string }[]) =>
  ids.map((id) => options.find((o) => o.id === id)?.label ?? id).join("・");

/** 集団の属性（複数選択）に対して、その曲がどれだけの人に届くか */
function checkConditions(song: Song, c: Room["conditions"]): ConditionCheck[] {
  const checks: ConditionCheck[] = [];

  // ジャンル: 選んだどれかに当てはまればよい（1曲が複数ジャンルになることはないため）
  if (c.genres.length > 0) {
    checks.push({ score: c.genres.includes(song.genre) ? 1 : 0, label: genreLabel(song.genre) });
  }
  // 国籍・年代: 選んだ属性のうち、いくつでよく聴かれているか（全員に届く曲ほど高い）
  if (c.nationalities.length > 0) {
    const hit = c.nationalities.filter((n) => song.nationalityTags.includes(n));
    checks.push({ score: hit.length / c.nationalities.length, label: hit.length ? `${labelsOf(hit, NATIONALITIES)}で人気` : null });
  }
  if (c.ageGroups.length > 0) {
    const hit = c.ageGroups.filter((id) =>
      AGE_GROUPS.find((a) => a.id === id)?.generations.some((g) => song.generationTags.includes(g))
    );
    checks.push({ score: hit.length / c.ageGroups.length, label: hit.length ? `${labelsOf(hit, AGE_GROUPS)}に届く` : null });
  }
  // 性別: 片方だけなら歌いやすいボーカルを優先、両方なら男女混合なのでどの曲でもよい
  if (c.genders.length === 1) {
    const ok = !song.vocal || song.vocal === "mixed" || song.vocal === c.genders[0];
    checks.push({ score: ok ? 1 : 0, label: ok ? `${labelsOf(c.genders, GENDERS)}が歌いやすい` : null });
  }
  return checks;
}

/**
 * AIレコメンド（集まる人たちの属性 × 参加者の好みの周辺）。
 * 議事録: 「調節機能を元に、参加者の好みの周辺にある楽曲を拾っていく」「OFFなら投稿とSpotifyデータのみ」
 * スコア = 属性のカバー率² × 0.6 + 「その他」の雰囲気の一致 × 0.15 + 参加者の好みへの近さ × 0.25
 */
export function recommendForRoom(room: Room, candidates: CandidateEntry[], catalog: Song[], limit = 8): Recommendation[] {
  if (!room.aiEnabled) return [];
  const c = room.conditions;
  const existing = new Set(candidates.map((x) => normalizeKey(x.song)));
  const profile = buildProfile(candidates);
  const wantedMoods = moodsFromText(c.other);
  const relatedArtists = new Set(profile.artists.slice(0, 10).flatMap((a) => RELATED_ARTISTS[a] ?? []));

  const results: Recommendation[] = [];
  for (const song of catalog) {
    if (existing.has(normalizeKey(song))) continue;

    const checks = checkConditions(song, c);
    const conditionScore = checks.length > 0 ? checks.reduce((sum, x) => sum + x.score, 0) / checks.length : 0.5;
    // 選んだ属性の半分も満たさない曲は「該当しない」とみなす
    if (checks.length > 0 && conditionScore < 0.5) continue;

    const matchedMoods = wantedMoods.filter((m) => song.moods?.includes(m));
    const moodScore = wantedMoods.length > 0 ? matchedMoods.length / wantedMoods.length : 0;
    const isRelated = relatedArtists.has(song.artist);
    const proximity = profile.isEmpty ? 0.5 : Math.min(1, profile.genreAffinity(song.genre) * 0.7 + (isRelated ? 0.5 : 0));

    // 選んだ条件を1つでも外すと大きく下がるよう二乗する（雰囲気が合うだけの曲が上位に来ないように）
    const score = 0.6 * conditionScore ** 2 + 0.15 * moodScore + 0.25 * proximity;
    const reasonParts = checks
      .filter((x) => x.score > 0 && x.label)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.label as string);
    if (matchedMoods.length > 0 && c.other.trim()) reasonParts.push(`「${c.other.trim().slice(0, 12)}」に合う`);
    if (isRelated) reasonParts.push("みんなの好きなアーティストに近い");
    results.push({ song, score, reason: reasonParts.slice(0, 2).join("・") || "みんなの好みに近い曲" });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * 「あなたへのおすすめ」（曲を候補に追加する画面）。
 * 自分が持ち込んだ曲（Spotifyでよく聴く曲・手動で追加した曲）のアーティストに近いアーティストの曲を提案する。
 * 何も持ち込んでいない人には、ルームの条件からのおすすめを出す。
 */
export function recommendForMember(
  memberId: string,
  room: Room,
  candidates: CandidateEntry[],
  catalog: Song[],
  limit = 6
): Recommendation[] {
  const existing = new Set(candidates.map((x) => normalizeKey(x.song)));
  const mine = candidates.filter((c) => c.memberId === memberId).sort((a, b) => b.weight - a.weight);
  if (mine.length === 0) {
    return recommendForRoom({ ...room, aiEnabled: true }, candidates, catalog, limit);
  }

  const results: Recommendation[] = [];
  const picked = new Set<string>();
  const push = (song: Song, score: number, reason: string) => {
    const key = normalizeKey(song);
    if (existing.has(key) || picked.has(key)) return;
    picked.add(key);
    results.push({ song, score, reason });
  };

  const myArtists = [...new Set(mine.map((c) => canonicalArtist(c.song.artist)))];
  for (const artist of myArtists) {
    for (const related of RELATED_ARTISTS[artist] ?? []) {
      catalog.filter((s) => s.artist === related).forEach((s) => push(s, 0.9, `${artist}をよく聴くあなたに`));
    }
  }

  const myGenres = new Map<Genre, number>();
  for (const c of mine) if (c.song.genre !== "other") myGenres.set(c.song.genre, (myGenres.get(c.song.genre) ?? 0) + 1);
  const topGenre = [...myGenres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topGenre) {
    catalog
      .filter((s) => s.genre === topGenre)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .forEach((s) => push(s, 0.6, `${genreLabel(topGenre)}をよく聴くあなたに`));
  }

  return results.slice(0, limit);
}
