"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { applyArtistMeta, lookupArtistMeta } from "@/lib/music-source/musicbrainz";

/**
 * Spotify取り込み曲・投稿曲のジャンル/国をMusicBrainzから1曲ずつ補完する（画面は持たない）。
 * MusicBrainzのレート制限があるので並列にはしない。同じアーティストはキャッシュから即時に返る。
 */
export default function MetadataEnricher() {
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const nextPending = useAppStore((s) =>
    [...s.importedSongs, ...s.submittedSongs].find((song) => song.metaStatus === "pending")
  );
  const running = useRef(false);

  useEffect(() => {
    if (!hasHydrated || !nextPending || running.current) return;
    running.current = true;
    lookupArtistMeta(nextPending.artist, nextPending.mbArtistId)
      .then((meta) => applyArtistMeta(nextPending, meta))
      .catch(() => ({ ...nextPending, metaStatus: "done" as const }))
      .then((updated) => {
        running.current = false;
        useAppStore.getState().updateSong(updated);
      });
  }, [hasHydrated, nextPending]);

  return null;
}
