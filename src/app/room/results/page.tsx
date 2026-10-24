"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, ExternalLink, Play } from "lucide-react";
import { AppHeader, TabBar } from "@/components/ui";
import { useRoom } from "@/components/RoomProvider";
import FinalSongBanner from "@/components/FinalSongBanner";
import SongArtwork from "@/components/SongArtwork";
import { roomBackend } from "@/lib/room";
import { spotifyOpenUrl } from "@/lib/music-source/spotify";

const SHOWN = 10;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function updatedLabel(updatedAt: number, now: number) {
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 30) return "たった今更新";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}分前に更新`;
  return "1時間以上前に更新";
}

const sourceLabel = (item: { fromSpotify: boolean; fromManual: boolean; ai: unknown; memberIds: string[] }) =>
  [
    item.memberIds.length >= 2 && `${item.memberIds.length}人が被り`,
    item.fromSpotify && "よく聴く曲",
    item.fromManual && "投稿",
    item.ai && "AIおすすめ",
  ]
    .filter(Boolean)
    .join(" · ");

export default function ResultsPage() {
  const { roomId, snapshot, ranking, updatedAt, isHost } = useRoom();
  const now = useNow(10_000);
  const [selected, setSelected] = useState<string | null>(null);

  // 前回の順位と比べて上がった・下がったを出す（描画中に前回値を更新する「派生state」パターン）
  const signature = ranking.map((r) => `${r.key}:${r.pt}`).join("|");
  const [rankState, setRankState] = useState<{ signature: string; ranks: Map<string, number>; deltas: Map<string, number> }>(
    () => ({ signature, ranks: new Map(ranking.map((r, i) => [r.key, i])), deltas: new Map() })
  );
  if (rankState.signature !== signature) {
    const deltas = new Map<string, number>();
    ranking.forEach((r, i) => {
      const before = rankState.ranks.get(r.key);
      if (before !== undefined && before !== i) deltas.set(r.key, before - i);
    });
    setRankState({ signature, ranks: new Map(ranking.map((r, i) => [r.key, i])), deltas });
  }

  const voters = new Set(snapshot.votes.filter((v) => v.score !== null).map((v) => v.memberId)).size;
  const finalId = snapshot.room.finalSongId;

  return (
    <>
      <AppHeader title="投票結果" backHref={`/room?room=${roomId}`} />
      <main className="flex flex-1 flex-col gap-3 px-4 pb-6">
        <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
          <span className="flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-bold text-accent">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-accent/60" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            リアルタイム更新
          </span>
          <span className="text-right">
            <span className="block text-[14px] font-bold">
              {voters} / {snapshot.members.length}人が投票中
            </span>
            <span className="block text-[11px] text-muted">{updatedLabel(updatedAt, now)}</span>
          </span>
        </div>

        <FinalSongBanner />

        {ranking.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-muted">まだ候補がありません</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {ranking.slice(0, SHOWN).map((item, i) => {
              const delta = rankState.deltas.get(item.key);
              const top = i < 3;
              const open = selected === item.key;
              const isFinal = finalId !== null && (item.song.id === finalId || item.songIds.includes(finalId));
              return (
                <li
                  key={item.key}
                  className={`rounded-2xl border transition ${top ? "border-accent/15 bg-accent-soft/70" : "border-line bg-surface"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(open ? null : item.key)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${
                        top ? "bg-accent text-on-accent" : "bg-no-soft text-ink"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <SongArtwork song={item.song} className="h-12 w-12 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{item.song.title}</span>
                      <span className="block truncate text-[12px] text-muted">{item.song.artist}</span>
                    </span>
                    {delta !== undefined && (
                      <span className={`flex shrink-0 items-center text-[13px] font-bold ${delta > 0 ? "text-best" : "text-muted"}`}>
                        {delta > 0 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                        {Math.abs(delta)}
                      </span>
                    )}
                    <span className={`w-[64px] shrink-0 text-right font-bold ${top ? "text-accent" : ""}`}>
                      <span className="text-[22px]">{item.pt}</span>
                      <span className="text-[12px]">pt</span>
                    </span>
                  </button>
                  {open && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-black/5 px-3 py-2.5 text-[12px]">
                      <span className="mr-auto text-muted">
                        {sourceLabel(item)}
                        {item.voteAverage !== null && ` · 平均${item.voteAverage.toFixed(1)}点（${item.voteCount}票）`}
                      </span>
                      <a
                        href={spotifyOpenUrl(item.song)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-bold"
                      >
                        <ExternalLink size={13} />
                        Spotify
                      </a>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => roomBackend.setFinalSong(roomId, isFinal ? null : item.song.id)}
                          className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 font-bold text-on-accent"
                        >
                          {isFinal ? <Check size={13} /> : <Play size={13} fill="currentColor" />}
                          {isFinal ? "選択中（解除）" : "この曲を流す"}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <p className="text-center text-[12px] text-muted">投票の追加・変更にあわせて順位が変わります</p>
        <p className="text-center text-[11px] text-muted/80">
          pt = 候補ランキング（被った人数・よく聴く度合い・AI）40% ＋ スワイプ平均 60%
          {isHost && " ／ 曲をタップして「この曲を流す」で決定"}
        </p>
      </main>
      <TabBar roomId={roomId} active="results" />
    </>
  );
}
