"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Plus } from "lucide-react";
import { AppHeader, TabBar, primaryButton } from "@/components/ui";
import { useRoom } from "@/components/RoomProvider";
import FinalSongBanner from "@/components/FinalSongBanner";
import MemberAvatar from "@/components/MemberAvatar";
import InviteQr from "@/components/InviteQr";
import AiPicksPanel from "@/components/AiPicksPanel";
import { roomBackend } from "@/lib/room";
import { BASE_PATH } from "@/lib/config";
import { AGE_GROUPS, GENDERS, GENRES, NATIONALITIES } from "@/types";

export default function RoomHubPage() {
  const { roomId, snapshot, me } = useRoom();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const { room, members } = snapshot;
  const c = room.conditions;

  const labels = <T extends string>(ids: T[], options: { id: T; label: string }[]) =>
    ids.map((id) => options.find((o) => o.id === id)?.label).filter(Boolean).join("・");
  const conditionText = [
    labels(c.genres, GENRES),
    labels(c.nationalities, NATIONALITIES),
    labels(c.ageGroups, AGE_GROUPS),
    labels(c.genders, GENDERS),
    c.other.trim() && `「${c.other.trim()}」`,
  ]
    .filter(Boolean)
    .join(" / ");

  const copyInvite = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${BASE_PATH}/join?room=${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <AppHeader title="みんなの選曲ルーム" backHref="/" />
      <main className="flex flex-1 flex-col gap-6 px-5 pb-6 pt-2">
        <FinalSongBanner />

        {/* 投票と結果は下のタブから行けるので、ここでは「次にやること」だけを置く */}
        <section>
          <p className="text-[13px] text-muted">参加者 {members.length}人</p>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-3">
            {members.map((m) => (
              <li key={m.id} className="flex w-14 flex-col items-center gap-1.5">
                <MemberAvatar member={m} isMe={m.id === me.id} />
                <span className="w-full truncate text-center text-[11px]">{m.id === me.id ? "あなた" : m.name}</span>
              </li>
            ))}
          </ul>
        </section>

        <AiPicksPanel />

        <Link href={`/room/add?room=${roomId}`} className={primaryButton}>
          <Plus size={20} />
          曲を候補に入れる
        </Link>

        <section className="border-t border-line pt-4 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">友だちを呼ぶ</span>
            <span className="flex items-center gap-4">
              <button type="button" onClick={() => setShowQr((v) => !v)} className="font-bold text-accent">
                {showQr ? "QRを閉じる" : "QRコード"}
              </button>
              <button type="button" onClick={copyInvite} className="flex items-center gap-1 font-bold text-accent">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "コピーしました" : "招待URLをコピー"}
              </button>
            </span>
          </div>
          {showQr && (
            <div className="mt-4">
              <InviteQr url={`${window.location.origin}${BASE_PATH}/join?room=${roomId}`} roomId={roomId} size={200} />
            </div>
          )}
          <p className="mt-3 text-muted">
            おすすめ曲の提案: {room.aiEnabled ? "ON" : "OFF"}
            {room.aiEnabled && conditionText && `（${conditionText}）`}
          </p>
        </section>

        {roomBackend.kind === "local" && (
          <p className="rounded-xl bg-crown-soft px-4 py-3 text-[12px] leading-relaxed text-ink/80">
            ローカルモード: Supabase未設定のため、このルームはこの端末のブラウザ内だけで共有されます。
          </p>
        )}
      </main>
      <TabBar roomId={roomId} />
    </>
  );
}
