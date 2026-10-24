"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, User } from "lucide-react";
import { AppHeader, outlineButton, primaryButton, Spinner, SpotifyLogo, spotifyButton } from "@/components/ui";
import { roomBackend } from "@/lib/room";
import { saveIdentity, useRoomIdentity } from "@/lib/room/identity";
import { startSpotifyLogin } from "@/lib/music-source/spotify";
import type { RoomSnapshot } from "@/types";

function JoinRoom() {
  const router = useRouter();
  const roomId = useSearchParams().get("room");
  const identity = useRoomIdentity(roomId);
  const [loaded, setLoaded] = useState<{ roomId: string; snapshot: RoomSnapshot | null } | null>(null);
  const [mode, setMode] = useState<"choose" | "guest">("choose");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    roomBackend
      .fetchSnapshot(roomId)
      .then((snapshot) => !cancelled && setLoaded({ roomId, snapshot }))
      .catch(() => !cancelled && setLoaded({ roomId, snapshot: null }));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const snapshot = loaded?.roomId === roomId ? loaded.snapshot : undefined;
  const alreadyJoined = Boolean(identity?.memberId && snapshot?.members.some((m) => m.id === identity.memberId));

  useEffect(() => {
    if (alreadyJoined && roomId) router.replace(`/room?room=${roomId}`);
  }, [alreadyJoined, roomId, router]);

  const joinAsGuest = async () => {
    if (!roomId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const member = await roomBackend.joinRoom(roomId, { name: name.trim(), kind: "guest" });
      saveIdentity(roomId, { memberId: member.id });
      if (identity?.isHost) await roomBackend.setHost(roomId, member.id);
      router.replace(`/room?room=${roomId}`);
    } catch {
      setError("参加できませんでした。もう一度お試しください。");
      setBusy(false);
    }
  };

  const joinWithSpotify = async () => {
    if (!roomId) return;
    setBusy(true);
    setError(null);
    try {
      await startSpotifyLogin({ roomId });
    } catch {
      setBusy(false);
      setError("この環境ではSpotifyログインを開始できません。https のサイトか http://127.0.0.1:3000 で開いてください。");
    }
  };

  if (!roomId || snapshot === null) {
    return (
      <>
        <AppHeader title="ルームに参加" backHref="/" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-lg font-bold">ルームが見つかりません</p>
          <p className="text-sm leading-relaxed text-muted">
            {roomBackend.kind === "local"
              ? "いまはデモモード（この端末のブラウザ内だけで共有）です。別の端末で作ったルームには参加できません。"
              : "招待URLが正しいか確認してください。"}
          </p>
          <Link href="/" className="mt-2 text-sm font-bold text-accent underline">
            トップへ戻る
          </Link>
        </div>
      </>
    );
  }
  if (snapshot === undefined || alreadyJoined) return <Spinner label="ルームを確認中…" />;

  return (
    <>
      <AppHeader title="ルームに参加" backHref="/" />
      <main className="flex flex-1 flex-col px-4 pb-8">
        <section className="flex flex-col items-center rounded-2xl bg-surface px-5 pb-8 pt-10 text-center">
          <span className="font-display text-[32px] leading-none text-accent">Musiconnect</span>
          <h2 className="mt-5 text-[22px] font-bold">みんなの選曲ルーム</h2>
          <p className="mt-1.5 text-[14px] text-muted">
            {snapshot.members.length > 0 ? `${snapshot.members.length}人が参加中 · ` : ""}参加方法を選んでください
          </p>

          {mode === "choose" ? (
            <div className="mt-8 flex w-full flex-col gap-3">
              <button type="button" onClick={joinWithSpotify} disabled={busy} className={spotifyButton}>
                <SpotifyLogo />
                <span className="flex-1 text-center">{busy ? "Spotifyに移動中…" : "Spotifyで登録・連携"}</span>
                <ChevronRight size={20} />
              </button>
              <button type="button" onClick={() => setMode("guest")} disabled={busy} className={outlineButton}>
                <User size={20} />
                <span className="flex-1 text-center">アカウントを持っていない</span>
                <ChevronRight size={20} />
              </button>
              <p className="mt-3 text-[12px] text-muted">Spotifyなしでも参加できます</p>
              <p className="text-[11px] leading-relaxed text-muted/80">
                Spotify連携すると、過去1ヶ月によく聴いた曲がみんなの候補に入ります
              </p>
            </div>
          ) : (
            <div className="mt-8 flex w-full flex-col gap-3 text-left">
              <label className="text-[14px] font-bold">
                ニックネーム
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: たろう"
                  maxLength={20}
                  autoFocus
                  className="mt-1.5 w-full rounded-xl border border-line bg-app px-4 py-3 text-[16px] font-normal outline-none focus:border-accent"
                />
              </label>
              <button type="button" onClick={joinAsGuest} disabled={busy || !name.trim()} className={primaryButton}>
                {busy ? "参加中…" : "参加する"}
              </button>
              <button type="button" onClick={() => setMode("choose")} className="text-[13px] text-muted underline">
                戻る
              </button>
            </div>
          )}
          {error && <p className="mt-4 text-[13px] text-heart">{error}</p>}
        </section>
      </main>
    </>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <JoinRoom />
    </Suspense>
  );
}
