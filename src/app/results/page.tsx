"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import SongCard from "@/components/SongCard";
import { useAppStore } from "@/store/useAppStore";
import { computeFinalRanking } from "@/lib/logic/ranking";
import type { Song } from "@/types";

const SOURCE_LABEL: Record<string, string> = {
  common: "共通曲",
  submitted: "投稿曲",
  recommended: "おすすめ",
};

export default function ResultsPage() {
  const router = useRouter();
  const scene = useAppStore((s) => s.scene);
  const participants = useAppStore((s) => s.participants);
  const candidates = useAppStore((s) => s.candidates);
  const votes = useAppStore((s) => s.votes);
  const resetAll = useAppStore((s) => s.resetAll);
  const hasHydrated = useAppStore((s) => s.hasHydrated);

  const [nowPlaying, setNowPlaying] = useState<Song | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!scene) router.replace("/");
    else if (candidates.length === 0) router.replace("/candidates");
  }, [hasHydrated, scene, candidates.length, router]);

  const ranking = useMemo(() => computeFinalRanking(candidates, votes), [candidates, votes]);

  if (!hasHydrated) return null;

  return (
    <PageShell
      step="results"
      title="プレイリスト結果"
      subtitle="共通曲ランキング × スワイプ投票スコアの加重平均で決定"
    >
      <div className="flex flex-col gap-3">
        {ranking.slice(0, 12).map((r, i) => (
          <div key={r.song.id} className="relative flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-lg font-black text-white/50">{i + 1}</span>
            <div className="flex-1">
              <SongCard song={r.song} compact>
                <div className="flex items-center justify-between bg-black/25 px-4 py-1.5 text-[11px] text-white/80">
                  <span>
                    {SOURCE_LABEL[r.source]} · 👥{r.knownByCount}/{participants.length} · 投票{r.voteCount}件
                  </span>
                  <span className="font-bold">{Math.round(r.finalScore * 100)}点</span>
                </div>
              </SongCard>
            </div>
            <button
              onClick={() => setNowPlaying(r.song)}
              className="shrink-0 rounded-full bg-fuchsia-500/90 px-3 py-2 text-xs font-bold text-white hover:bg-fuchsia-500"
            >
              ▶ 流す
            </button>
          </div>
        ))}
      </div>

      {ranking.length === 0 && <p className="text-sm text-white/50">候補曲がありません。</p>}

      {nowPlaying && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 shrink-0 rounded-lg"
              style={{ background: `linear-gradient(135deg, ${nowPlaying.colorFrom}, ${nowPlaying.colorTo})` }}
            />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold text-white">▶ 再生中: {nowPlaying.title}</p>
              <p className="truncate text-xs text-white/50">{nowPlaying.artist}</p>
            </div>
            <button onClick={() => setNowPlaying(null)} className="text-white/50 hover:text-white">
              ✕
            </button>
          </div>
          {/* TODO: 実際の再生はSpotify連携後に音源プレイヤーへ置き換え。MVPでは曲情報表示のみ。 */}
        </div>
      )}

      <div className={`mt-8 ${nowPlaying ? "pb-20" : ""}`}>
        <button
          onClick={() => {
            resetAll();
            router.push("/");
          }}
          className="w-full rounded-full bg-white/10 py-3.5 text-center font-bold text-white hover:bg-white/20"
        >
          もう一度最初から
        </button>
      </div>
    </PageShell>
  );
}
