"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Plus } from "lucide-react";
import { AppHeader, TabBar, primaryButton } from "@/components/ui";
import { useRoom } from "@/components/RoomProvider";
import FinalSongBanner from "@/components/FinalSongBanner";
import MemberAvatar from "@/components/MemberAvatar";
import AiPicksPanel from "@/components/AiPicksPanel";
import { roomBackend } from "@/lib/room";
import { BASE_PATH } from "@/lib/config";
import { addDemoMembers } from "@/lib/demo";
import { AGE_GROUPS, GENDERS, GENRES, NATIONALITIES } from "@/types";

export default function RoomHubPage() {
  const { roomId, snapshot, me, isHost } = useRoom();
  const [copied, setCopied] = useState(false);
  const [demoState, setDemoState] = useState<"idle" | "adding" | "done">("idle");
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

  const addDemo = async () => {
    setDemoState("adding");
    try {
      await addDemoMembers(roomId);
      setDemoState("done");
    } catch {
      setDemoState("idle");
    }
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
            <button type="button" onClick={copyInvite} className="flex items-center gap-1 font-bold text-accent">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "コピーしました" : "招待URLをコピー"}
            </button>
          </div>
          <p className="mt-3 text-muted">
            おすすめ曲の提案: {room.aiEnabled ? "ON" : "OFF"}
            {room.aiEnabled && conditionText && `（${conditionText}）`}
          </p>
        </section>

        {isHost && (
          <button
            type="button"
            onClick={addDemo}
            disabled={demoState !== "idle"}
            className="flex items-center justify-center gap-1.5 py-2 text-[12px] text-muted underline disabled:no-underline"
          >
            {demoState === "adding" ? "デモ用メンバーを追加中…" : demoState === "done" ? "デモ用メンバーを追加しました" : "デモ用に5人追加する（発表用）"}
          </button>
        )}

        {roomBackend.kind === "local" && (
          <p className="rounded-xl bg-crown-soft px-4 py-3 text-[12px] leading-relaxed text-ink/80">
            デモモード: Supabase未設定のため、このルームはこの端末のブラウザ内だけで共有されます。
          </p>
        )}
      </main>
      <TabBar roomId={roomId} />
    </>
  );
}
