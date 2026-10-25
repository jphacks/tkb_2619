"use client";

import { Fragment, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, ExternalLink, Pause, Play } from "lucide-react";
import { AppHeader, TabBar } from "@/components/ui";
import { useRoom } from "@/components/RoomProvider";
import FinalSongBanner from "@/components/FinalSongBanner";
import SongArtwork from "@/components/SongArtwork";
import { RankingPlayerBar, useRankingPlayer } from "@/components/RankingPlayer";
import { roomBackend } from "@/lib/room";
import { spotifyOpenUrl } from "@/lib/music-source/spotify";

const SHOWN = 20;

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

  const player = useRankingPlayer(ranking);
  const nowIndex = ranking.findIndex((i) => i.key === player.nowKey);
  const nowItem = nowIndex >= 0 ? ranking[nowIndex] : null;

  const voters = new Set(snapshot.votes.filter((v) => v.score !== null).map((v) => v.memberId)).size;
  const finalId = snapshot.room.finalSongId;

  return (
    <>
      <AppHeader title="投票結果" backHref={`/room?room=${roomId}`} />
      <main className="flex flex-1 flex-col gap-3 px-4 pb-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] tabular-nums text-muted">
            {voters}/{snapshot.members.length}人が投票 · {updatedLabel(updatedAt, now)}
          </p>
          {ranking.length > 0 && (
            <button
              type="button"
              onClick={() => player.playFrom(ranking[0].key)}
              className="flex shrink-0 items-center gap-1 text-[13px] font-bold text-accent"
            >
              <Play size={13} fill="currentColor" />
              1位から流す
            </button>
          )}
        </div>

        <FinalSongBanner
          playingKey={player.playing ? player.nowKey : null}
          onPlay={(key) => (player.nowKey === key ? player.toggle() : player.playFrom(key))}
        />

        {ranking.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-muted">まだ候補がないみたい</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {ranking.slice(0, SHOWN).map((item, i, shown) => {
              const delta = rankState.deltas.get(item.key);
              const voted = item.voteCount > 0;
              const top = i < 3 && voted;
              const open = selected === item.key;
              const isFinal = finalId !== null && (item.song.id === finalId || item.songIds.includes(finalId));
              const firstUnvoted = !voted && (i === 0 || shown[i - 1].voteCount > 0);
              const isNow = player.nowKey === item.key;
              return (
                <Fragment key={item.key}>
                  {firstUnvoted && (
                    <li className="pb-1 pt-5 text-[12px] text-muted">まだ誰も投票してない曲</li>
                  )}
                  <li>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setSelected(open ? null : item.key)}
                        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
                      >
                        <span
                          className={`w-6 shrink-0 text-center text-[15px] font-bold tabular-nums ${top ? "text-accent" : "text-muted"}`}
                        >
                          {i + 1}
                        </span>
                        <SongArtwork song={item.song} className="h-12 w-12 rounded-md" />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[15px] font-bold ${isNow ? "text-accent" : ""}`}>{item.song.title}</span>
                          <span className="block truncate text-[12px] text-muted">{item.song.artist}</span>
                        </span>
                        {delta !== undefined && (
                          <span className={`flex shrink-0 items-center text-[13px] font-bold ${delta > 0 ? "text-best" : "text-muted"}`}>
                            {delta > 0 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                            {Math.abs(delta)}
                          </span>
                        )}
                        {voted ? (
                          <span className="w-[52px] shrink-0 text-right tabular-nums">
                            <span className="text-[18px] font-bold">{item.pt}</span>
                            <span className="text-[11px] text-muted">pt</span>
                          </span>
                        ) : (
                          <span className="w-[52px] shrink-0 text-right text-[12px] text-muted">未投票</span>
                        )}
                      </button>
                      {/* ここから下の順位を続けて流す。再生中の曲なら一時停止・再開 */}
                      <button
                        type="button"
                        aria-label={isNow && player.playing ? "一時停止" : "ここから再生"}
                        onClick={() => (isNow ? player.toggle() : player.playFrom(item.key))}
                        className={`ml-1 shrink-0 p-2 ${isNow ? "text-accent" : "text-muted"}`}
                      >
                        {isNow && player.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                      </button>
                    </div>
                    {open && (
                      <div className="flex flex-wrap items-center gap-2 pb-3 pl-9 text-[12px]">
                        <span className="mr-auto text-muted">
                          {sourceLabel(item)}
                          {item.voteAverage !== null && ` · 平均${item.voteAverage.toFixed(1)}点（${item.voteCount}票）`}
                        </span>
                        <a
                          href={spotifyOpenUrl(item.song)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 font-bold"
                        >
                          <ExternalLink size={13} />
                          Spotifyで聴く
                        </a>
                        {/* 幹事だけが「次に流す曲」を決められる。決めた曲は全員の画面の上に出る */}
                        {isHost &&
                          (isFinal ? (
                            <>
                              <span className="flex items-center gap-1 rounded-lg bg-accent-soft px-2.5 py-1.5 font-bold text-accent">
                                <Check size={13} />
                                次に流す曲
                              </span>
                              <button
                                type="button"
                                onClick={() => roomBackend.setFinalSong(roomId, null)}
                                className="px-1.5 py-1.5 text-muted underline"
                              >
                                取り消す
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => roomBackend.setFinalSong(roomId, item.song.id)}
                              className="rounded-lg bg-accent px-2.5 py-1.5 font-bold text-on-accent"
                            >
                              次に流す曲に決める
                            </button>
                          ))}
                      </div>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}

        {isHost && <p className="text-[12px] text-muted">曲をタップすると、次に流す曲に決められます</p>}
      </main>
      <div className="sticky bottom-0 z-20">
        {nowItem && (
          <RankingPlayerBar
            item={nowItem}
            rank={nowIndex + 1}
            playing={player.playing}
            loading={player.loading}
            progress={player.progress}
            onToggle={player.toggle}
            onNext={player.next}
            onClose={player.stop}
          />
        )}
        <TabBar roomId={roomId} active="results" />
      </div>
    </>
  );
}
