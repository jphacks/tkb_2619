"use client";

import { ExternalLink } from "lucide-react";
import { useRoom } from "./RoomProvider";
import SongArtwork from "./SongArtwork";
import { spotifyOpenUrl } from "@/lib/music-source/spotify";

/** 曲を流す人が最後に選んだ曲（全員に表示） */
export default function FinalSongBanner() {
  const { snapshot, pool } = useRoom();
  const finalId = snapshot.room.finalSongId;
  if (!finalId) return null;
  const item = pool.find((p) => p.song.id === finalId || p.songIds.includes(finalId));
  if (!item) return null;

  return (
    <a
      href={spotifyOpenUrl(item.song)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl bg-teal p-3 text-white shadow-md"
    >
      <SongArtwork song={item.song} className="h-12 w-12 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-white/70">♪ 次に流す曲</span>
        <span className="block truncate text-[15px] font-bold">{item.song.title}</span>
        <span className="block truncate text-[12px] text-white/80">{item.song.artist}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-[12px] font-bold">
        Spotifyで開く
        <ExternalLink size={13} />
      </span>
    </a>
  );
}
