"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useRoom } from "./RoomProvider";
import SongArtwork from "./SongArtwork";

/**
 * 幹事が「次に流す曲」に決めた曲（全員に表示）。
 * 結果画面ではその場で再生でき（onPlay）、それ以外の画面では結果画面へ案内する。
 */
export default function FinalSongBanner({
  onPlay,
  playingKey,
}: {
  /** 結果画面のプレイヤーで、この曲から流す */
  onPlay?: (key: string) => void;
  /** いま再生中の曲（この曲なら一時停止アイコンにする） */
  playingKey?: string | null;
}) {
  const { roomId, snapshot, pool } = useRoom();
  const finalId = snapshot.room.finalSongId;
  if (!finalId) return null;
  const item = pool.find((p) => p.song.id === finalId || p.songIds.includes(finalId));
  if (!item) return null;
  const isPlaying = playingKey === item.key;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-accent p-3 text-on-accent">
      <SongArtwork song={item.song} className="h-12 w-12 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-on-accent/70">次に流す曲</span>
        <span className="block truncate text-[15px] font-bold">{item.song.title}</span>
        <span className="block truncate text-[12px] text-on-accent/80">{item.song.artist}</span>
      </span>
      {onPlay ? (
        <button
          type="button"
          onClick={() => onPlay(item.key)}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-on-accent/10 px-3 py-2 text-[13px] font-bold"
        >
          {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          {isPlaying ? "一時停止" : "再生"}
        </button>
      ) : (
        <Link
          href={`/room/results?room=${roomId}`}
          className="shrink-0 rounded-lg bg-on-accent/10 px-3 py-2 text-[13px] font-bold"
        >
          結果で聴く
        </Link>
      )}
    </div>
  );
}
