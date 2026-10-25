"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Undo2 } from "lucide-react";
import { TabBar, primaryButton } from "@/components/ui";
import { useRoom } from "@/components/RoomProvider";
import VoteCard, { type SourceLine } from "@/components/VoteCard";
import SwipeReaction, { type Reaction } from "@/components/SwipeReaction";
import { roomBackend } from "@/lib/room";
import { myVoteFor, type PoolItem } from "@/lib/logic/ranking";
import { spotifyOpenUrl } from "@/lib/music-source/spotify";
import { SWIPE_SCORES, type CandidateEntry, type Member, type SwipeDirection, type VoteScore } from "@/types";

// 評価ごとに色を分けて、ひと目でどれを押すか分かるようにする（色は配色テーマの評価色に連動）
const SCORE_BUTTONS: { score: VoteScore; label: string; color: string; direction: SwipeDirection }[] = [
  { score: 0, label: "Nope", color: "bg-no-soft text-no", direction: "left" },
  { score: 1, label: "So-so", color: "bg-meh-soft text-meh", direction: "down" },
  { score: 2, label: "Better", color: "bg-better-soft text-better", direction: "right" },
  { score: 3, label: "Best", color: "bg-best-soft text-best", direction: "up" },
];

/**
 * 吹き出しに出す「この曲がどこから来たか」。誰かが聴いている曲 → 誰かの投稿 → AIレコメンド の順に最大2行。
 * 同じ人が聴いていて投稿もしている場合は「聴いてる」だけを出す。
 */
function sourceLines(item: PoolItem, candidates: CandidateEntry[], members: Member[], myId: string): SourceLine[] {
  const nameOf = (id: string) => (id === myId ? "あなた" : (members.find((m) => m.id === id)?.name ?? "だれか"));
  const who = (ids: string[]) => (ids.length <= 2 ? ids.map(nameOf).join("と") : `${nameOf(ids[0])}たち${ids.length}人`);
  const entries = candidates.filter((c) => item.songIds.includes(c.songId));
  const listeners = [...new Set(entries.filter((c) => c.source === "spotify").map((c) => c.memberId))];
  const posters = [...new Set(entries.filter((c) => c.source === "manual").map((c) => c.memberId))].filter(
    (id) => !listeners.includes(id)
  );
  const lines: SourceLine[] = [];
  if (listeners.length > 0) lines.push({ who: who(listeners), text: "が聴いてるよ！" });
  if (posters.length > 0) lines.push({ who: who(posters), text: "の投稿" });
  if (lines.length === 0 && item.ai) lines.push({ text: "AIレコメンド" });
  return lines.slice(0, 2);
}

export default function VotePage() {
  const { roomId, snapshot, me, deck } = useRoom();
  // サーバーに反映されるまでの間も次の曲へ進めるよう、手元でも評価済み・取り消し済みを覚えておく
  const [localVoted, setLocalVoted] = useState<Set<string>>(new Set());
  const [localUndone, setLocalUndone] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<PoolItem[]>([]);
  const [forced, setForced] = useState<SwipeDirection | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const reactionId = useRef(0);

  // 評価した直後に「Better!」などを大きく出して、少ししたら消す
  const react = (direction: SwipeDirection) => {
    const id = ++reactionId.current;
    setReaction({ id, direction });
    setTimeout(() => setReaction((r) => (r?.id === id ? null : r)), 700);
  };

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
      <main className="relative flex flex-1 flex-col px-4 pb-4 pt-6">
        <SwipeReaction reaction={reaction} />
        <h1 className="text-[22px] font-bold leading-tight">この曲、聴きたい？</h1>

        {deck.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-[15px] text-muted">まだ候補がないみたい</p>
            <Link href={`/room/add?room=${roomId}`} className={`${primaryButton} max-w-xs`}>
              曲を候補に追加
            </Link>
          </div>
        ) : !current ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-[17px] font-bold">ぜんぶ聴き終わりました</p>
            <Link href={`/room/results?room=${roomId}`} className={`${primaryButton} max-w-xs`}>
              結果を見る
            </Link>
            <button type="button" onClick={undo} className="flex items-center gap-1.5 text-[13px] font-bold text-accent">
              <Undo2 size={16} />
              ひとつ戻す
            </button>
          </div>
        ) : (
          <>
            <div className="mt-2 flex items-center gap-3 text-[12px] tabular-nums text-muted">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full bg-accent transition-all"
                  style={{ width: `${((doneCount + 1) / deck.length) * 100}%` }}
                />
              </span>
              {doneCount + 1}/{deck.length}
            </div>

            <div className="mt-5">
              <VoteCard
                key={current.key}
                song={current.song}
                sources={sourceLines(current, snapshot.candidates, snapshot.members, me.id)}
                forced={forced}
                onPlay={() => play(current)}
                onDone={(direction) => {
                  react(direction);
                  commit(current, SWIPE_SCORES[direction].score);
                }}
              />
            </div>
            {/* スワイプの向きは、最初の1曲を評価するまでだけ出す */}
            {history.length === 0 && doneCount === 0 && (
              <p className="mt-3 text-center text-[12px] text-muted">↑ Best　→ Better　↓ So-so　← Nope</p>
            )}

            {playing === current.key && current.song.spotifyId && (
              <iframe
                title="Spotifyで試聴"
                src={`https://open.spotify.com/embed/track/${current.song.spotifyId}?theme=0`}
                className="mt-3 h-20 w-full rounded-xl border-0"
                allow="autoplay; clipboard-write; encrypted-media"
              />
            )}

            <div className="mt-5 grid grid-cols-4 gap-2">
              {SCORE_BUTTONS.map(({ score, label, color, direction }) => (
                <button
                  key={score}
                  type="button"
                  disabled={forced !== null}
                  onClick={() => setForced(direction)}
                  className={`rounded-xl py-3 text-[14px] font-bold transition active:scale-95 active:brightness-125 ${color}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
              <button
                type="button"
                onClick={undo}
                disabled={doneCount === 0}
                className="flex items-center gap-1 py-1 disabled:opacity-30"
              >
                <Undo2 size={15} />
                戻す
              </button>
              <button type="button" onClick={() => commit(current, null)} className="py-1">
                知らない曲
              </button>
            </div>
          </>
        )}
      </main>
      <TabBar roomId={roomId} active="vote" />
    </>
  );
}
