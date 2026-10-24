"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import SwipeDeck from "@/components/SwipeDeck";
import { useAppStore } from "@/store/useAppStore";
import { DIRECTION_TO_SCORE, type SwipeDirection } from "@/types";

export default function VotePage() {
  const router = useRouter();
  const scene = useAppStore((s) => s.scene);
  const participants = useAppStore((s) => s.participants);
  const candidates = useAppStore((s) => s.candidates);
  const votes = useAppStore((s) => s.votes);
  const currentVoterId = useAppStore((s) => s.currentVoterId);
  const setCurrentVoterId = useAppStore((s) => s.setCurrentVoterId);
  const castVote = useAppStore((s) => s.castVote);
  const hasHydrated = useAppStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!scene) router.replace("/");
    else if (participants.length < 2) router.replace("/participants");
    else if (candidates.length === 0) router.replace("/candidates");
  }, [hasHydrated, scene, participants.length, candidates.length, router]);

  const votesByParticipant = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of votes) map.set(v.participantId, (map.get(v.participantId) ?? 0) + 1);
    return map;
  }, [votes]);

  const currentVoter = participants.find((p) => p.id === currentVoterId) ?? null;

  const unvotedSongs = useMemo(() => {
    if (!currentVoter) return [];
    const votedIds = new Set(
      votes.filter((v) => v.participantId === currentVoter.id).map((v) => v.songId)
    );
    return candidates.map((c) => c.song).filter((s) => !votedIds.has(s.id));
  }, [currentVoter, votes, candidates]);

  const handleSwipe = (songId: string, direction: SwipeDirection) => {
    if (!currentVoter) return;
    castVote({
      participantId: currentVoter.id,
      songId,
      score: DIRECTION_TO_SCORE[direction],
      direction,
    });
  };

  const allDone = participants.every((p) => (votesByParticipant.get(p.id) ?? 0) >= candidates.length);

  if (!hasHydrated) return null;

  return (
    <PageShell
      step="vote"
      title={currentVoter ? `${currentVoter.emoji} ${currentVoter.name} の投票中` : "投票する人を選んでね"}
      subtitle={
        currentVoter
          ? "上下左右にスワイプ、またはボタンで評価しよう"
          : "端末を回しながら、1人ずつスワイプ投票しよう"
      }
    >
      {!currentVoter && (
        <div className="grid grid-cols-2 gap-3">
          {participants.map((p) => {
            const done = (votesByParticipant.get(p.id) ?? 0) >= candidates.length;
            return (
              <button
                key={p.id}
                onClick={() => setCurrentVoterId(p.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-4 transition ${
                  done ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <span className="text-3xl">{p.emoji}</span>
                <span className="text-sm font-semibold text-white">{p.name}</span>
                <span className="text-[11px] text-white/50">
                  {done ? "投票済み ✓" : `${votesByParticipant.get(p.id) ?? 0}/${candidates.length}曲`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {currentVoter && unvotedSongs.length > 0 && (
        <SwipeDeck
          songs={unvotedSongs}
          onSwipe={(song, direction) => handleSwipe(song.id, direction)}
          onComplete={() => setCurrentVoterId(null)}
        />
      )}

      {currentVoter && unvotedSongs.length === 0 && (
        <div className="flex flex-col items-center gap-4 pt-10 text-center">
          <p className="text-lg font-bold text-white">投票完了！🎉</p>
          <button
            onClick={() => setCurrentVoterId(null)}
            className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
          >
            参加者選択に戻る
          </button>
        </div>
      )}

      {!currentVoter && (
        <div className="sticky bottom-4 mt-8">
          <button
            disabled={votes.length === 0}
            onClick={() => router.push("/results")}
            className="w-full rounded-full bg-fuchsia-500 py-3.5 text-center font-bold text-white shadow-lg shadow-fuchsia-500/30 transition disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
          >
            {allDone ? "結果を見る →" : "ここまでの結果を見る →"}
          </button>
        </div>
      )}
    </PageShell>
  );
}
