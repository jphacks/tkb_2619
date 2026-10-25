"use client";

import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import type { Song } from "@/types";
import { lookupArtwork } from "@/lib/music-source/musicbrainz";
import { normalizeKey } from "@/lib/music-source";

const MAX_RETRIES = 2;

/**
 * ジャケット画像。Spotify・MusicBrainz検索の曲はURLを持っている。
 * カタログ曲はMusicBrainz（Cover Art Archive）から探す。
 * Cover Art Archive（archive.org）は応答が遅く、一度に読むとタイムアウトすることがあるため、
 * 読み込めるまでは色付きの代替表示を出し、失敗したら少し待って再試行する。
 */
export default function SongArtwork({ song, className = "", large = false }: { song: Song; className?: string; large?: boolean }) {
  const key = normalizeKey(song);
  const [lookedUp, setLookedUp] = useState<{ key: string; url: string | null } | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failures, setFailures] = useState<{ url: string; count: number } | null>(null);

  useEffect(() => {
    if (song.artworkUrl) return;
    let cancelled = false;
    lookupArtwork(song)
      .then((url) => !cancelled && setLookedUp({ key, url }))
      .catch(() => !cancelled && setLookedUp({ key, url: null }));
    return () => {
      cancelled = true;
    };
    // song の中身が変わっても key が同じなら同じ曲
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, song.artworkUrl]);

  const baseUrl = song.artworkUrl ?? (lookedUp?.key === key ? lookedUp.url : null);
  // 投票カードのように大きく出すときは、Apple の画像を高解像度で取り直す（小さい画像を引き伸ばすとぼやけるため）
  const url = large && baseUrl ? baseUrl.replace(/\/\d+x\d+bb\./, "/600x600bb.") : baseUrl;
  const failCount = url && failures?.url === url ? failures.count : 0;
  const loaded = url !== null && loadedUrl === url;

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${song.colorFrom}, ${song.colorTo})` }}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80">
          <Music className="h-1/3 w-1/3" />
        </div>
      )}
      {url && failCount <= MAX_RETRIES && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${url}#${failCount}`}
          src={url}
          alt=""
          // ブラウザ標準の画像ドラッグが始まると、投票カードのスワイプが効かなくなる
          draggable={false}
          onLoad={() => setLoadedUrl(url)}
          onError={() => setTimeout(() => setFailures({ url, count: failCount + 1 }), 2000 * (failCount + 1))}
          className={`pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
