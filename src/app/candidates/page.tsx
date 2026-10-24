"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import SongCard from "@/components/SongCard";
import { useAppStore } from "@/store/useAppStore";
import { musicSource, type SongQuery } from "@/lib/music-source";
import { extractCommonSongs } from "@/lib/logic/common-songs";
import { buildVoteCandidates } from "@/lib/logic/candidates";
import { buildDefaultFiltersFromParticipants, recommendByAttributes, type AttributeFilters } from "@/lib/logic/recommend";
import { GENERATIONS, GENRES, NATIONALITIES, type CandidateSong, type Song } from "@/types";

const inputClass =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-fuchsia-400 focus:outline-none";

const queryKey = (q: SongQuery) => `${q.title.trim()}\u0000${q.artist?.trim() ?? ""}`;

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
  const importedSongs = useAppStore((s) => s.importedSongs);
  const addSubmittedSong = useAppStore((s) => s.addSubmittedSong);
  const setCandidates = useAppStore((s) => s.setCandidates);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const enrichingCount = useAppStore(
    (s) => [...s.importedSongs, ...s.submittedSongs].filter((song) => song.metaStatus === "pending").length
  );

  const [catalog, setCatalog] = useState<Song[]>([]);
  const [filters, setFilters] = useState<AttributeFilters>(() =>
    buildDefaultFiltersFromParticipants(useAppStore.getState().participants)
  );
  const [titleInput, setTitleInput] = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [query, setQuery] = useState<SongQuery>({ title: "", artist: "" });
  const [search, setSearch] = useState<{ key: string; songs: Song[]; error: string | null }>({
    key: "",
    songs: [],
    error: null,
  });

  useEffect(() => {
    if (!hasHydrated) return;
    if (!scene) router.replace("/");
    else if (participants.length < 2) router.replace("/participants");
  }, [hasHydrated, scene, participants.length, router]);

  useEffect(() => {
    musicSource.getAllSongs().then(setCatalog);
  }, []);

  // MusicBrainzはレート制限があるので、入力が止まってから検索する
  useEffect(() => {
    const timer = setTimeout(() => setQuery({ title: titleInput, artist: artistInput }), 600);
    return () => clearTimeout(timer);
  }, [titleInput, artistInput]);

  useEffect(() => {
    if (!query.title.trim()) return;
    let cancelled = false;
    const key = queryKey(query);
    musicSource
      .searchSongs(query)
      .then((songs) => !cancelled && setSearch({ key, songs, error: null }))
      .catch(() => !cancelled && setSearch({ key, songs: [], error: "検索に失敗しました。少し待ってからもう一度お試しください。" }));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const hasQuery = titleInput.trim().length > 0;
  const searchIsCurrent =
    hasQuery && search.key === queryKey(query) && queryKey(query) === queryKey({ title: titleInput, artist: artistInput });
  const searching = hasQuery && !searchIsCurrent;

  const allSongs = useMemo(() => [...catalog, ...importedSongs], [catalog, importedSongs]);

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

  // Spotify（英語表記）とカタログ（日本語表記）で同じ曲が別アーティスト名になるため、
  // 共通曲・投稿曲と同じタイトルのおすすめ曲は出さない
  const knownTitles = useMemo(
    () => new Set([...commonSongs, ...submittedCandidates].map((c) => c.song.title.trim().toLowerCase())),
    [commonSongs, submittedCandidates]
  );

  const recommended = useMemo(
    () =>
      recommendByAttributes(allSongs, filters).filter(
        (c) =>
          !commonIds.has(c.song.id) &&
          !submittedIds.has(c.song.id) &&
          !knownTitles.has(c.song.title.trim().toLowerCase())
      ),
    [allSongs, filters, commonIds, submittedIds, knownTitles]
  );

  const combined = useMemo(
    () => buildVoteCandidates(commonSongs, submittedCandidates, recommended),
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
      {enrichingCount > 0 && (
        <p className="mb-4 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
          🔎 ジャンル・国の情報をMusicBrainzから取得中（残り{enrichingCount}曲）。取得でき次第、属性レコメンドに反映されます。
        </p>
      )}

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
        <div className="mb-3 grid grid-cols-2 gap-2">
          <input
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="曲名"
            className={inputClass}
          />
          <input
            value={artistInput}
            onChange={(e) => setArtistInput(e.target.value)}
            placeholder="アーティスト（推奨）"
            className={inputClass}
          />
        </div>
        {searching && <p className="mb-3 text-xs text-white/50">MusicBrainzで検索中…</p>}
        {searchIsCurrent && search.error && <p className="mb-3 text-xs text-rose-300">{search.error}</p>}
        {searchIsCurrent && !search.error && search.songs.length === 0 && (
          <p className="mb-3 text-xs text-white/50">見つかりませんでした。アーティスト名も入れると見つかりやすくなります。</p>
        )}
        {searchIsCurrent && search.songs.length > 0 && (
          <div className="mb-3 flex flex-col gap-1 rounded-lg border border-white/10 bg-black/20 p-2">
            {search.songs.slice(0, 8).map((song) => (
              <button
                key={song.id}
                onClick={() => {
                  addSubmittedSong(song);
                  setTitleInput("");
                  setArtistInput("");
                }}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-white/80 hover:bg-white/10"
              >
                <span className="min-w-0">
                  <span className="block truncate">{song.title}</span>
                  <span className="block truncate text-xs text-white/40">
                    {song.artist}
                    {song.year ? ` · ${song.year}` : ""}
                    {song.origin === "musicbrainz" ? " · MusicBrainz" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-fuchsia-300">+追加</span>
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
