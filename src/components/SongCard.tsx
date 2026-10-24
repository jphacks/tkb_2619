import type { Song } from "@/types";
import { GENRES } from "@/types";

const genreLabel = (genre: Song["genre"]) => GENRES.find((g) => g.id === genre)?.label ?? genre;

export default function SongCard({
  song,
  children,
  compact = false,
}: {
  song: Song;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className="relative flex w-full flex-col overflow-hidden rounded-2xl shadow-xl select-none"
      style={{
        background: `linear-gradient(135deg, ${song.colorFrom}, ${song.colorTo})`,
      }}
    >
      <div className={`flex flex-col gap-1 p-4 ${compact ? "py-3" : "py-8"}`}>
        <span className="w-fit rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white/90">
          {genreLabel(song.genre)} · {song.year}
        </span>
        <h3 className={`font-bold text-white drop-shadow ${compact ? "text-base" : "text-2xl mt-2"}`}>
          {song.title}
        </h3>
        <p className={`text-white/85 ${compact ? "text-xs" : "text-sm"}`}>{song.artist}</p>
      </div>
      {children}
    </div>
  );
}
