"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, SkipForward, Undo2 } from "lucide-react";
import { TabBar, outlineButton, primaryButton } from "@/components/ui";
import { useRoom } from "@/components/RoomProvider";
import VoteCard from "@/components/VoteCard";
import { roomBackend } from "@/lib/room";
import { myVoteFor, type PoolItem } from "@/lib/logic/ranking";
import { spotifyOpenUrl } from "@/lib/music-source/spotify";
import { SWIPE_SCORES, type SwipeDirection, type VoteScore } from "@/types";

const SCORE_BUTTONS: { score: VoteScore; label: string; className: string; direction: SwipeDirection }[] = [
  { score: 0, label: "今は違う", className: "bg-no-soft text-no", direction: "left" },
  { score: 1, label: "うーん", className: "bg-meh-soft text-meh", direction: "down" },
  { score: 2, label: "Better", className: "bg-better-soft text-better", direction: "right" },
  { score: 3, label: "Best", className: "bg-best-soft text-best", direction: "up" },
];

function DirectionLabel({ direction }: { direction: SwipeDirection }) {
  const { score, label } = SWIPE_SCORES[direction];
  const Arrow = { up: ArrowUp, right: ArrowRight, down: ArrowDown, left: ArrowLeft }[direction];
  const color = { up: "text-best", right: "text-better", down: "text-meh", left: "text-no" }[direction];
  const chip = { up: "bg-best-soft", right: "bg-better-soft", down: "bg-meh-soft", left: "bg-no-soft" }[direction];
  const vertical = direction === "up" || direction === "down";
  return (
    <div className={`flex items-center gap-1 ${vertical ? "flex-row" : "flex-col"} ${color}`}>
      {direction !== "down" && <Arrow size={vertical ? 26 : 30} strokeWidth={2.6} />}
      <span className={`flex items-center gap-1 ${vertical ? "flex-row" : "flex-col"}`}>
        <span className="text-[14px] font-bold">{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${chip}`}>{score}点</span>
      </span>
      {direction === "down" && <Arrow size={26} strokeWidth={2.6} />}
    </div>
  );
}

export default function VotePage() {
  const { roomId, snapshot, me, deck } = useRoom();
  // サーバーに反映されるまでの間も次の曲へ進めるよう、手元でも評価済み・取り消し済みを覚えておく
  const [localVoted, setLocalVoted] = useState<Set<string>>(new Set());
  const [localUndone, setLocalUndone] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<PoolItem[]>([]);
  const [forced, setForced] = useState<SwipeDirection | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const isDone = (item: PoolItem) =>
    localVoted.has(item.key) || (!localUndone.has(item.key) && Boolean(myVoteFor(item, snapshot.votes, me.id)));
  const remaining = deck.filter((item) => !isDone(item));
  const current = remaining[0] ?? null;
  const doneCount = deck.length - remaining.length;

  const commit = (item: PoolItem, score: VoteScore | null) => {
    setForced(null);
    setPlaying(null);
    setLocalVoted((s) => new Set(s).add(item.key));
    setLocalUndone((s) => {
      const next = new Set(s);
      next.delete(item.key);
      return next;
    });
    setHistory((h) => [...h, item]);
    roomBackend.setVote(roomId, me.id, item.song.id, score).catch(() => {
      setLocalVoted((s) => {
        const next = new Set(s);
        next.delete(item.key);
        return next;
      });
    });
  };

  const undo = () => {
    const last =
      history[history.length - 1] ??
      [...deck]
        .filter((item) => isDone(item))
        .sort((a, b) => (myVoteFor(b, snapshot.votes, me.id)?.updatedAt ?? "").localeCompare(myVoteFor(a, snapshot.votes, me.id)?.updatedAt ?? ""))[0];
    if (!last) return;
    setHistory((h) => h.filter((item) => item.key !== last.key));
    setLocalVoted((s) => {
      const next = new Set(s);
      next.delete(last.key);
      return next;
    });
    setLocalUndone((s) => new Set(s).add(last.key));
    const vote = myVoteFor(last, snapshot.votes, me.id);
    void roomBackend.deleteVote(roomId, me.id, vote?.songId ?? last.song.id);
  };

  const play = (item: PoolItem) => {
    if (item.song.spotifyId) setPlaying((p) => (p === item.key ? null : item.key));
    else window.open(spotifyOpenUrl(item.song), "_blank", "noopener");
  };

  return (
    <>
      <main className="flex flex-1 flex-col px-4 pb-4 pt-6">
        <h1 className="text-center text-[22px] font-bold">この曲、聴きたい？</h1>

        {deck.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-[15px] text-muted">まだ投票する曲がありません。<br />まずは候補を追加しましょう。</p>
            <Link href={`/room/add?room=${roomId}`} className={`${primaryButton} max-w-xs`}>
              曲を候補に追加
            </Link>
          </div>
        ) : !current ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-[40px]">🎉</p>
            <p className="text-[17px] font-bold">{deck.length}曲すべて評価しました</p>
            <p className="text-[13px] text-muted">みんなの投票が入るたびにランキングが更新されます</p>
            <Link href={`/room/results?room=${roomId}`} className={`${primaryButton} max-w-xs`}>
              結果を見る
            </Link>
            <button type="button" onClick={undo} className="flex items-center gap-1.5 text-[13px] font-bold text-teal">
              <Undo2 size={16} />
              ひとつ戻す
            </button>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-3 flex w-full max-w-[260px] items-center gap-3 text-[13px] text-muted">
              <span className="shrink-0">
                {doneCount + 1} / {deck.length}曲
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-teal transition-all"
                  style={{ width: `${((doneCount + 1) / deck.length) * 100}%` }}
                />
              </span>
            </div>

            <div className="mt-3 flex justify-center">
              <DirectionLabel direction="up" />
            </div>
            <div className="mt-2 grid grid-cols-[64px_1fr_64px] items-center gap-1">
              <DirectionLabel direction="left" />
              <div className="relative">
                <div className="absolute inset-0 -rotate-3 scale-[0.96] rounded-[22px] bg-white/70 shadow-sm" />
                <div className="absolute inset-0 rotate-2 scale-[0.98] rounded-[22px] bg-white/80 shadow-sm" />
                <VoteCard
                  key={current.key}
                  song={current.song}
                  forced={forced}
                  onPlay={() => play(current)}
                  onDone={(direction) => commit(current, SWIPE_SCORES[direction].score)}
                />
              </div>
              <DirectionLabel direction="right" />
            </div>
            <div className="mt-2 flex justify-center">
              <DirectionLabel direction="down" />
            </div>

            {playing === current.key && current.song.spotifyId && (
              <iframe
                title="Spotifyで試聴"
                src={`https://open.spotify.com/embed/track/${current.song.spotifyId}?theme=0`}
                className="mt-3 h-20 w-full rounded-xl border-0"
                allow="autoplay; clipboard-write; encrypted-media"
              />
            )}

            <div className="mt-4 grid grid-cols-4 gap-2">
              {SCORE_BUTTONS.map(({ score, label, className, direction }) => (
                <button
                  key={score}
                  type="button"
                  disabled={forced !== null}
                  onClick={() => setForced(direction)}
                  className={`flex flex-col items-center rounded-2xl py-2.5 transition active:scale-95 ${className}`}
                >
                  <span className="text-[22px] font-bold leading-tight">{score}</span>
                  <span className="text-[12px] font-bold">{label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={undo}
                disabled={doneCount === 0}
                className={`${outlineButton} whitespace-nowrap px-3 py-3 text-[14px] text-teal`}
              >
                <Undo2 size={18} />
                ひとつ戻す
              </button>
              <button
                type="button"
                onClick={() => commit(current, null)}
                className={`${outlineButton} whitespace-nowrap border-line px-3 py-3 text-[13px]`}
              >
                <SkipForward size={18} />
                知らない・スキップ
              </button>
            </div>
            <p className="mt-3 text-center text-[12px] text-muted">評価すると次の曲へ進みます</p>
          </>
        )}
      </main>
      <TabBar roomId={roomId} active="vote" />
    </>
  );
}
