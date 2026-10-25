"use client";

import { useEffect, useRef, useState } from "react";
import type { Song } from "@/types";
import { knownPreviewUrl, lookupPreviewUrl } from "@/lib/music-source/preview";
import { spotifyOpenUrl } from "@/lib/music-source/spotify";

/**
 * 1曲だけの試聴（30秒）。投票カードの▶で使う。
 * 試聴が見つからない曲は、これまでどおり Spotify で開く。
 */
export function useSongPreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  useEffect(() => {
    const a = new Audio();
    audio.current = a;
    const done = () => setPlayingKey(null);
    a.addEventListener("ended", done);
    a.addEventListener("pause", done);
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.removeEventListener("ended", done);
      a.removeEventListener("pause", done);
    };
  }, []);

  const stop = () => audio.current?.pause();

  const toggle = async (key: string, song: Song) => {
    const a = audio.current;
    if (!a) return;
    if (playingKey === key) {
      a.pause();
      return;
    }
    // 先に見つけてある曲は待たずに再生する（iPhone はタップ直後でないと音を出せない）
    const known = knownPreviewUrl(song);
    const url = known === undefined ? await lookupPreviewUrl(song) : known;
    if (!url) {
      window.open(spotifyOpenUrl(song), "_blank", "noopener");
      return;
    }
    a.src = url;
    setPlayingKey(key);
    await a.play().catch(() => setPlayingKey(null));
  };

  return { playingKey, toggle, stop };
}

/** 次に▶されそうな曲の試聴URLを先に探しておく */
export function usePrefetchPreviews(songs: Song[]) {
  const ids = songs.map((s) => s.id).join("|");
  useEffect(() => {
    for (const song of songs) void lookupPreviewUrl(song);
    // 曲の並びが変わったときだけ探し直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
}
