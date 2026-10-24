"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { exchangeCodeForToken, importSpotifyLibrary, SpotifyError } from "@/lib/music-source/spotify";

function SpotifyCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const setPendingImport = useAppStore((s) => s.setPendingImport);
  const started = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);

  const code = params.get("code");
  const state = params.get("state");
  const deniedOrMissing = params.get("error")
    ? "Spotifyでのログインがキャンセルされました。"
    : !code
    ? "Spotifyから認可コードを受け取れませんでした。"
    : null;

  useEffect(() => {
    if (!hasHydrated || !code || deniedOrMissing || started.current) return;
    started.current = true;
    exchangeCodeForToken(code, state)
      .then(importSpotifyLibrary)
      .then(({ spotifyUserId, displayName, songs }) => {
        setPendingImport({ spotifyUserId, displayName, songIds: songs.map((s) => s.id) }, songs);
        router.replace("/participants");
      })
      .catch((error: unknown) => {
        setFailure(error instanceof SpotifyError ? error.message : "Spotifyとの通信に失敗しました。");
      });
  }, [hasHydrated, code, state, deniedOrMissing, setPendingImport, router]);

  const message = deniedOrMissing ?? failure;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {message ? (
        <>
          <p className="text-lg font-bold text-white">連携できませんでした</p>
          <p className="text-sm text-white/70">{message}</p>
          <Link
            href="/participants"
            className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
          >
            参加者選択に戻る
          </Link>
        </>
      ) : (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-emerald-400" />
          <p className="text-sm text-white/80">Spotifyから聴いている曲を取り込み中…</p>
        </>
      )}
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <SpotifyCallback />
    </Suspense>
  );
}
