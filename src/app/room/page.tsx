"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, Crown, Heart, Music, Sparkles, UserPlus, Users } from "lucide-react";
import { AppHeader, TabBar } from "@/components/ui";
import { useRoom } from "@/components/RoomProvider";
import FinalSongBanner from "@/components/FinalSongBanner";
import { roomBackend } from "@/lib/room";
import { BASE_PATH } from "@/lib/config";
import { addDemoMembers } from "@/lib/demo";
import { myVoteFor } from "@/lib/logic/ranking";
import { AGE_GROUPS, GENDERS, GENRES, NATIONALITIES } from "@/types";

const MENU = [
  { tab: "add", title: "手動で曲を選択", body: "検索・おすすめから候補を追加", Icon: Music, color: "bg-accent-soft text-accent" },
  { tab: "vote", title: "投票", body: "スワイプで聴きたい曲を評価", Icon: Heart, color: "bg-heart-soft text-heart" },
  { tab: "results", title: "結果", body: "最新のランキングを見る", Icon: Crown, color: "bg-crown-soft text-crown" },
] as const;

export default function RoomHubPage() {
  const { roomId, snapshot, me, isHost, deck } = useRoom();
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

  const myVotes = deck.filter((item) => myVoteFor(item, snapshot.votes, me.id)).length;

  return (
    <>
      <AppHeader title="みんなの選曲ルーム" backHref="/" />
      <main className="flex flex-1 flex-col gap-3 px-4 pb-6">
        <div className="flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-ink/10 px-3.5 py-1.5 text-[13px] font-bold">
            <Users size={15} />
            {members.length}人が参加中
          </span>
        </div>

        <FinalSongBanner />

        {MENU.map(({ tab, title, body, Icon, color }) => (
          <Link
            key={tab}
            href={`/room/${tab}?room=${roomId}`}
            className="flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition active:scale-[0.99]"
          >
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${color}`}>
              <Icon size={26} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[18px] font-bold">{title}</span>
              <span className="block text-[13px] text-muted">
                {tab === "vote" && deck.length > 0 ? `${body}（${myVotes}/${deck.length}曲）` : body}
              </span>
            </span>
            <ChevronRight size={22} className="text-muted" />
          </Link>
        ))}

        <section className="mt-2 rounded-2xl bg-surface p-4 text-[13px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-0.5 text-muted">
              <Sparkles size={12} />
              AIレコメンド{room.aiEnabled ? "ON" : "OFF"}
            </span>
            <button type="button" onClick={copyInvite} className="flex items-center gap-1 font-bold text-accent">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "コピーしました" : "招待URLをコピー"}
            </button>
          </div>
          {room.aiEnabled && conditionText && <p className="mt-1.5 text-[12px] text-muted">集まる人: {conditionText}</p>}
          <p className="mt-1.5 text-[12px] text-muted">
            参加者: {members.map((m) => (m.id === me.id ? `${m.name}（あなた）` : m.name)).join("、")}
          </p>
        </section>

        {isHost && (
          <button
            type="button"
            onClick={addDemo}
            disabled={demoState !== "idle"}
            className="flex items-center justify-center gap-1.5 py-2 text-[12px] text-muted underline disabled:no-underline"
          >
            <UserPlus size={14} />
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
