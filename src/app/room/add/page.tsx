"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { AppHeader, TabBar } from "@/components/ui";
import { useRoom } from "@/components/RoomProvider";
import { SongRow } from "@/components/SongRow";
import { roomBackend } from "@/lib/room";
import { CATALOG, musicSource, normalizeKey } from "@/lib/music-source";
import { recommendForMember } from "@/lib/logic/recommend";
import type { Song } from "@/types";

export default function AddSongsPage() {
  const { roomId, snapshot, me } = useRoom();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{ query: string; songs: Song[]; error: boolean }>({ query: "", songs: [], error: false });
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  // 追加した瞬間に一覧から消えないよう、おすすめは画面を開いた時点のものを使い続ける
  const [recommendations] = useState(() => recommendForMember(me.id, snapshot.room, snapshot.candidates, CATALOG));

  const myEntries = useMemo(
    () => new Map(snapshot.candidates.filter((c) => c.memberId === me.id).map((c) => [normalizeKey(c.song), c])),
    [snapshot.candidates, me.id]
  );
  const knownArtists = useMemo(() => new Set(snapshot.candidates.map((c) => c.song.artist)), [snapshot.candidates]);

  // MusicBrainzのレート制限があるので、入力が止まってから検索する
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 500);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    musicSource
      .searchSongs(query, knownArtists)
      .then((songs) => !cancelled && setSearch({ query, songs, error: false }))
      .catch(() => !cancelled && setSearch({ query, songs: [], error: true }));
    return () => {
      cancelled = true;
    };
    // 入力ごとの検索にしたいので、knownArtists の変化では再検索しない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const typed = input.trim();
  const showingResults = typed.length > 0 && search.query === typed && query === typed;
  const searching = typed.length > 0 && !showingResults;

  const toggle = async (song: Song) => {
    const key = normalizeKey(song);
    setBusyKeys((s) => new Set(s).add(key));
    try {
      const existing = myEntries.get(key);
      if (existing) {
        await roomBackend.removeCandidate(roomId, me.id, existing.songId);
      } else {
        await roomBackend.addCandidates([
          { roomId, memberId: me.id, songId: song.id, song, source: "manual", weight: 0 },
        ]);
      }
    } finally {
      setBusyKeys((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  };

  const row = (song: Song, note?: string) => {
    const key = normalizeKey(song);
    return (
      <SongRow
        key={song.id}
        song={song}
        note={note}
        added={myEntries.has(key)}
        busy={busyKeys.has(key)}
        onToggle={() => toggle(song)}
      />
    );
  };

  return (
    <>
      <AppHeader title="曲を候補に追加" backHref={`/room?room=${roomId}`} />
      <main className="flex flex-1 flex-col px-4 pb-6">
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] focus-within:border-teal">
          <Search size={22} className="shrink-0 text-ink" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="曲名・アーティスト名で検索"
            className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted/60"
          />
          {input && (
            <button
              type="button"
              aria-label="クリア"
              onClick={() => setInput("")}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/50 text-white"
            >
              <X size={15} strokeWidth={3} />
            </button>
          )}
        </div>

        {typed && (
          <section className="mt-5">
            <h2 className="text-[17px] font-bold">検索結果</h2>
            <div className="mt-1 divide-y divide-line rounded-2xl bg-white px-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              {searching && <p className="py-5 text-center text-[13px] text-muted">検索中…</p>}
              {showingResults && search.error && (
                <p className="py-5 text-center text-[13px] text-heart">検索に失敗しました。少し待ってからもう一度お試しください。</p>
              )}
              {showingResults && !search.error && search.songs.length === 0 && (
                <p className="py-5 text-center text-[13px] text-muted">見つかりませんでした。「曲名 アーティスト名」で探してみてください。</p>
              )}
              {showingResults && search.songs.map((song) => row(song))}
            </div>
          </section>
        )}

        <section className="mt-6 border-t border-line pt-5">
          <h2 className="text-[19px] font-bold">あなたへのおすすめ</h2>
          <p className="mt-0.5 text-[13px] text-muted">Spotifyに保存していない曲も、好みから提案</p>
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-teal-soft px-3.5 py-2.5 text-[13px] font-medium text-teal">
            <Sparkles size={17} />
            {snapshot.candidates.some((c) => c.memberId === me.id)
              ? "保存した曲・アーティストをもとに"
              : "このルームの条件をもとに（曲を追加すると好みに合わせて変わります）"}
          </p>
          <div className="mt-2 divide-y divide-line rounded-2xl bg-white px-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {recommendations.length === 0 ? (
              <p className="py-5 text-center text-[13px] text-muted">おすすめはまだありません</p>
            ) : (
              recommendations.map((r) => row(r.song, r.reason))
            )}
          </div>
        </section>

        <p className="mt-5 text-center text-[12px] text-muted">追加した曲はみんなの投票候補になります</p>
      </main>
      <TabBar roomId={roomId} active="add" />
    </>
  );
}
