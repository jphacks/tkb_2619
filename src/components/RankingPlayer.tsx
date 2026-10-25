"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipForward, X } from "lucide-react";
import type { RankedItem } from "@/lib/logic/ranking";
import { knownPreviewUrl, lookupPreviewUrl } from "@/lib/music-source/preview";
import SongArtwork from "./SongArtwork";

/** 先に試聴URLを探しておく曲数（タップした瞬間に再生を始めるため。iPhone はタップ直後でないと音を出せない） */
const PREFETCH = 12;
/** 試聴が見つからない曲が続いたら、そこで止める */
const MAX_SKIPS = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 結果のランキングを上から順に30秒ずつ流すプレイヤー。
 * 曲が終わったら、その時点のランキングで「次の順位」の曲へ進む（途中で順位が変わっても、今の並びに沿って続ける）。
 */
export function useRankingPlayer(ranking: RankedItem[]) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const latest = useRef(ranking);
  const current = useRef<{ key: string; index: number } | null>(null);
  const request = useRef(0);
  const [nowKey, setNowKey] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    latest.current = ranking;
  }, [ranking]);

  const stop = () => {
    request.current += 1;
    audio.current?.pause();
    current.current = null;
    setNowKey(null);
    setLoading(false);
    setProgress(0);
  };

  const playAt = async (index: number, skipped = 0): Promise<void> => {
    const item = latest.current[index];
    const a = audio.current;
    if (!item || !a || skipped > MAX_SKIPS) {
      stop();
      return;
    }
    const id = ++request.current;
    current.current = { key: item.key, index };
    setNowKey(item.key);
    setProgress(0);

    // 分かっている曲は待たずにその場で再生する（タップと同じ流れで play() を呼ぶ必要がある）
    const known = knownPreviewUrl(item.song);
    let url = known === undefined ? null : known;
    if (known === undefined) {
      setLoading(true);
      url = await lookupPreviewUrl(item.song);
      if (id !== request.current) return;
      setLoading(false);
    }
    if (!url) {
      await playAt(index + 1, skipped + 1);
      return;
    }
    a.src = url;
    await a.play().catch(() => setPlaying(false));
  };

  const next = () => {
    const cur = current.current;
    if (!cur) return;
    const idx = latest.current.findIndex((i) => i.key === cur.key);
    void playAt((idx >= 0 ? idx : cur.index) + 1);
  };

  // 再生用の audio は1つだけ作り、曲を差し替えて使い回す
  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audio.current = a;
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  // 曲が終わったら次の順位へ
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.addEventListener("ended", next);
    return () => a.removeEventListener("ended", next);
  });

  // 上位の曲の試聴URLを先に探しておく（iTunes の回数制限があるので少し間をあけて順番に）
  const topKeys = ranking.slice(0, PREFETCH).map((i) => i.key).join("|");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const item of latest.current.slice(0, PREFETCH)) {
        if (cancelled) return;
        if (knownPreviewUrl(item.song) !== undefined) continue;
        await lookupPreviewUrl(item.song);
        await sleep(300);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topKeys]);

  const playFrom = (key: string) => {
    const index = latest.current.findIndex((i) => i.key === key);
    if (index >= 0) void playAt(index);
  };

  const toggle = () => {
    const a = audio.current;
    if (!a || !current.current) return;
    if (a.paused) void a.play().catch(() => undefined);
    else a.pause();
  };

  return { nowKey, playing, loading, progress, playFrom, toggle, next, stop };
}

/** 画面下に出る再生中の曲。順位・再生/一時停止・次の曲・閉じる */
export function RankingPlayerBar({
  item,
  rank,
  playing,
  loading,
  progress,
  onToggle,
  onNext,
  onClose,
}: {
  item: RankedItem;
  rank: number;
  playing: boolean;
  loading: boolean;
  progress: number;
  onToggle: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <div className="border-t border-line bg-surface">
      <span className="block h-0.5 bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
      <div className="flex items-center gap-3 px-4 py-2">
        <SongArtwork song={item.song} className="h-10 w-10 rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">{item.song.title}</span>
          <span className="block truncate text-[11px] text-muted">
            {rank}位 · {loading ? "試聴を探しています…" : "試聴 30秒"}
          </span>
        </span>
        <button type="button" aria-label={playing ? "一時停止" : "再生"} onClick={onToggle} className="p-2 text-ink">
          {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
        <button type="button" aria-label="次の曲" onClick={onNext} className="p-2 text-ink">
          <SkipForward size={20} fill="currentColor" />
        </button>
        <button type="button" aria-label="閉じる" onClick={onClose} className="p-2 text-muted">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
