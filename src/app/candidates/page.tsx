"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import SongCard from "@/components/SongCard";
import { useAppStore } from "@/store/useAppStore";
import { musicSource } from "@/lib/music-source";
import { extractCommonSongs } from "@/lib/logic/common-songs";
import { buildDefaultFiltersFromParticipants, recommendByAttributes, type AttributeFilters } from "@/lib/logic/recommend";
import { GENERATIONS, GENRES, NATIONALITIES, type CandidateSong, type Song } from "@/types";

function mergeCandidates(groups: CandidateSong[][]): CandidateSong[] {
  const byId = new Map<string, CandidateSong>();
  for (const group of groups) {
    for (const candidate of group) {
      if (!byId.has(candidate.song.id)) byId.set(candidate.song.id, candidate);
    }
  }
  return Array.from(byId.values());
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200"
          : "border-white/15 text-white/60 hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}

export default function CandidatesPage() {
  const router = useRouter();
  const scene = useAppStore((s) => s.scene);
  const participants = useAppStore((s) => s.participants);
  const submittedSongs = useAppStore((s) => s.submittedSongs);
  const addSubmittedSong = useAppStore((s) => s.addSubmittedSong);
  const setCandidates = useAppStore((s) => s.setCandidates);
  const hasHydrated = useAppStore((s) => s.hasHydrated);

  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [filters, setFilters] = useState<AttributeFilters>(() =>
    buildDefaultFiltersFromParticipants(useAppStore.getState().participants)
  );
  const [query, setQuery] = useState("");
  const [rawSearchResults, setRawSearchResults] = useState<Song[]>([]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!scene) router.replace("/");
    else if (participants.length < 2) router.replace("/participants");
  }, [hasHydrated, scene, participants.length, router]);

  useEffect(() => {
    musicSource.getAllSongs().then(setAllSongs);
  }, []);

  useEffect(() => {
    if (query.trim().length === 0) return;
    let cancelled = false;
    musicSource.searchSongs(query).then((results) => {
      if (!cancelled) setRawSearchResults(results);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const searchResults = query.trim().length === 0 ? [] : rawSearchResults;

  const commonSongs = useMemo(
    () => extractCommonSongs(participants, allSongs),
    [participants, allSongs]
  );

  const commonIds = useMemo(() => new Set(commonSongs.map((c) => c.song.id)), [commonSongs]);

  const submittedCandidates = useMemo<CandidateSong[]>(
    () =>
      submittedSongs
        .filter((song) => !commonIds.has(song.id))
        .map((song) => ({ song, source: "submitted", knownByCount: 0, knownByRatio: 0, recommendScore: 0 })),
    [submittedSongs, commonIds]
  );

  const submittedIds = useMemo(() => new Set(submittedCandidates.map((c) => c.song.id)), [submittedCandidates]);

  const recommended = useMemo(
    () =>
      recommendByAttributes(allSongs, filters).filter(
        (c) => !commonIds.has(c.song.id) && !submittedIds.has(c.song.id)
      ),
    [allSongs, filters, commonIds, submittedIds]
  );

  const combined = useMemo(
    () => mergeCandidates([commonSongs, submittedCandidates, recommended]),
    [commonSongs, submittedCandidates, recommended]
  );

  useEffect(() => {
    setCandidates(combined);
  }, [combined, setCandidates]);

  const toggleInList = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  if (!hasHydrated) return null;

  return (
    <PageShell
      step="candidates"
      title="曲候補をチェック"
      subtitle="共通曲・投稿曲・おすすめ曲をまとめて確認しよう"
    >
      <section className="mb-7">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
          🎯 共通曲
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-normal text-white/50">
            {participants.length}人中、知っている人数順
          </span>
        </h2>
        {commonSongs.length === 0 ? (
          <p className="text-xs text-white/40">共通で知っている曲は見つかりませんでした。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {commonSongs.slice(0, 8).map((c) => (
              <div key={c.song.id} className="relative">
                <SongCard song={c.song} compact />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-2 py-1 text-[11px] font-bold text-white">
                  👥 {c.knownByCount}/{participants.length}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-7">
        <h2 className="mb-2 text-sm font-bold text-white">📝 投稿曲</h2>
        <div className="mb-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="曲名・アーティストで検索して追加"
            className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-fuchsia-400 focus:outline-none"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
            {searchResults.slice(0, 5).map((song) => (
              <button
                key={song.id}
                onClick={() => {
                  addSubmittedSong(song);
                  setQuery("");
                }}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-white/80 hover:bg-white/10"
              >
                <span>
                  {song.title} <span className="text-white/40">/ {song.artist}</span>
                </span>
                <span className="text-xs text-fuchsia-300">+追加</span>
              </button>
            ))}
          </div>
        )}
        {submittedCandidates.length === 0 ? (
          <p className="text-xs text-white/40">まだ投稿曲はありません。検索して追加してみよう。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {submittedCandidates.map((c) => (
              <SongCard key={c.song.id} song={c.song} compact />
            ))}
          </div>
        )}
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-sm font-bold text-white">✨ 属性レコメンド</h2>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {GENRES.map((g) => (
            <Chip
              key={g.id}
              active={filters.genres.includes(g.id)}
              onClick={() => setFilters((f) => ({ ...f, genres: toggleInList(f.genres, g.id) }))}
            >
              {g.label}
            </Chip>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {GENERATIONS.map((g) => (
            <Chip
              key={g.id}
              active={filters.generations.includes(g.id)}
              onClick={() => setFilters((f) => ({ ...f, generations: toggleInList(f.generations, g.id) }))}
            >
              {g.label}
            </Chip>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {NATIONALITIES.map((n) => (
            <Chip
              key={n.id}
              active={filters.nationalities.includes(n.id)}
              onClick={() => setFilters((f) => ({ ...f, nationalities: toggleInList(f.nationalities, n.id) }))}
            >
              {n.label}
            </Chip>
          ))}
        </div>
        {recommended.length === 0 ? (
          <p className="text-xs text-white/40">条件に一致する曲がありません。フィルタを調整してみて。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recommended.slice(0, 6).map((c) => (
              <div key={c.song.id} className="relative">
                <SongCard song={c.song} compact />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-2 py-1 text-[11px] font-bold text-white">
                  ✨ {Math.round(c.recommendScore * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="sticky bottom-4">
        <button
          disabled={combined.length === 0}
          onClick={() => router.push("/vote")}
          className="w-full rounded-full bg-fuchsia-500 py-3.5 text-center font-bold text-white shadow-lg shadow-fuchsia-500/30 transition disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
        >
          {combined.length}曲をスワイプ投票へ →
        </button>
      </div>
    </PageShell>
  );
}
