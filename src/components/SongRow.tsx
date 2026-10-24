"use client";

import { Check, Plus } from "lucide-react";
import type { Song } from "@/types";
import SongArtwork from "./SongArtwork";

export function SongRow({
  song,
  note,
  added,
  busy,
  onToggle,
}: {
  song: Song;
  note?: string;
  added: boolean;
  busy?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3.5 py-3">
      <SongArtwork song={song} className="h-[58px] w-[58px] rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">{song.title}</p>
        <p className="truncate text-[13px] text-muted">{song.artist}</p>
        {note && <p className="mt-0.5 truncate text-[12px] text-muted">{note}</p>}
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={`flex shrink-0 items-center gap-1 rounded-xl border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition disabled:opacity-60 ${
          added ? "border-accent bg-accent text-on-accent" : "border-accent text-accent hover:bg-accent-soft"
        }`}
      >
        {added ? <Check size={15} strokeWidth={3} /> : <Plus size={15} strokeWidth={3} />}
        {added ? "追加済み" : "追加"}
      </button>
    </div>
  );
}
