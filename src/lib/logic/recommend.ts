import type { CandidateSong, Generation, Genre, Nationality, Participant, Song } from "@/types";

export interface AttributeFilters {
  genres: Genre[];
  generations: Generation[];
  nationalities: Nationality[];
}

/**
 * 属性レコメンド: 世代・国籍・好きなジャンルのフィルタ条件と、曲ごとのメタデータ
 * (generationTags / nationalityTags / genre) の一致度からおすすめ曲を算出する。
 * マッチした属性の割合をそのまま recommendScore (0〜1) として使う簡易ロジック。
 */
export function recommendByAttributes(
  allSongs: Song[],
  filters: AttributeFilters
): CandidateSong[] {
  const totalCriteria =
    (filters.genres.length > 0 ? 1 : 0) +
    (filters.generations.length > 0 ? 1 : 0) +
    (filters.nationalities.length > 0 ? 1 : 0);

  if (totalCriteria === 0) return [];

  const results: CandidateSong[] = [];

  for (const song of allSongs) {
    let matched = 0;
    if (filters.genres.length > 0 && filters.genres.includes(song.genre)) matched += 1;
    if (
      filters.generations.length > 0 &&
      song.generationTags.some((g) => filters.generations.includes(g))
    )
      matched += 1;
    if (
      filters.nationalities.length > 0 &&
      song.nationalityTags.some((n) => filters.nationalities.includes(n))
    )
      matched += 1;

    if (matched === 0) continue;

    results.push({
      song,
      source: "recommended",
      knownByCount: 0,
      knownByRatio: 0,
      recommendScore: matched / totalCriteria,
    });
  }

  return results.sort((a, b) => b.recommendScore - a.recommendScore);
}

/** 参加者全員の属性から、デフォルトのフィルタ条件（最頻値）を作る */
export function buildDefaultFiltersFromParticipants(participants: Participant[]): AttributeFilters {
  const genreCount = new Map<Genre, number>();
  const generationCount = new Map<Generation, number>();
  const nationalityCount = new Map<Nationality, number>();

  for (const p of participants) {
    for (const g of p.favoriteGenres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    generationCount.set(p.generation, (generationCount.get(p.generation) ?? 0) + 1);
    nationalityCount.set(p.nationality, (nationalityCount.get(p.nationality) ?? 0) + 1);
  }

  const topEntries = <T,>(map: Map<T, number>, n: number): T[] =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key]) => key);

  return {
    genres: topEntries(genreCount, 3),
    generations: topEntries(generationCount, 5),
    nationalities: topEntries(nationalityCount, 5),
  };
}
