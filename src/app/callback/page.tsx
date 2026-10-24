"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui";
import { roomBackend } from "@/lib/room";
import { getIdentity, saveIdentity } from "@/lib/room/identity";
import { exchangeCodeForToken, importSpotifyLibrary, SpotifyError } from "@/lib/music-source/spotify";

function SpotifyCallback() {
  const router = useRouter();
  const params = useSearchParams();
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
    if (!code || deniedOrMissing || started.current) return;
    started.current = true;
    (async () => {
      const { token, context } = await exchangeCodeForToken(code, state);
      const { displayName, songs } = await importSpotifyLibrary(token);
      const { roomId } = context;

      const identity = getIdentity(roomId);
      const snapshot = await roomBackend.fetchSnapshot(roomId);
      if (!snapshot) throw new SpotifyError("ルームが見つかりませんでした。");
      let memberId = identity?.memberId && snapshot.members.some((m) => m.id === identity.memberId) ? identity.memberId : null;
      if (!memberId) {
        memberId = (await roomBackend.joinRoom(roomId, { name: displayName, kind: "spotify" })).id;
        saveIdentity(roomId, { memberId });
      }
      if (identity?.isHost && !snapshot.room.hostMemberId) await roomBackend.setHost(roomId, memberId);

      await roomBackend.addCandidates(
        songs.map(({ song, weight }) => ({ roomId, memberId, songId: song.id, song, source: "spotify" as const, weight }))
      );
      router.replace(`/room?room=${roomId}`);
    })().catch((error: unknown) => {
      setFailure(error instanceof SpotifyError ? error.message : "Spotifyとの連携に失敗しました。");
    });
  }, [code, state, deniedOrMissing, router]);

  const message = deniedOrMissing ?? failure;
  if (!message) return <Spinner label="Spotifyから過去1ヶ月によく聴いた曲を取り込み中…" />;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="text-lg font-bold">連携できませんでした</p>
      <p className="text-sm leading-relaxed text-muted">{message}</p>
      <Link href="/" className="mt-2 text-sm font-bold text-teal underline">
        トップへ戻る
      </Link>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SpotifyCallback />
    </Suspense>
  );
}
