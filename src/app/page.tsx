"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, ChevronRight, Mic, Music, PartyPopper } from "lucide-react";
import { primaryButton } from "@/components/ui";
import { roomBackend } from "@/lib/room";

const SCENE_CARDS = [
  { Icon: Mic, title: "カラオケ", gap: "世代のギャップ", body: "上司と部下でも、一緒に歌える曲が見つかる" },
  { Icon: PartyPopper, title: "パーティー", gap: "国籍のギャップ", body: "留学生や旅行者とも盛り上がれる曲を" },
  { Icon: Car, title: "ドライブ", gap: "ジャンルのギャップ", body: "同乗者みんなの好みに合う曲を流そう" },
];

/** 招待URLでもルームIDだけでも受け付ける */
function parseRoomId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const fromUrl = text.match(/[?&]room=([a-z0-9]+)/i)?.[1];
  return (fromUrl ?? text).toLowerCase().replace(/[^a-z0-9]/g, "") || null;
}

export default function HomePage() {
  const router = useRouter();
  const [invite, setInvite] = useState("");
  const roomId = parseRoomId(invite);

  return (
    <main className="flex flex-1 flex-col px-5 pb-10 pt-12">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal text-white shadow-md">
          <Music size={32} />
        </span>
        <h1 className="mt-4 text-[28px] font-black tracking-tight">musicconnect</h1>
        <p className="mt-1 text-[15px] font-medium text-muted">音楽で人と人を繋ぐ</p>
        <p className="mt-6 text-[15px] leading-relaxed">
          共通の一曲が、心を繋ぐ。
          <br />
          みんなが知っている曲・聴きたい曲を、投票で選ぼう。
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-2.5">
        {SCENE_CARDS.map(({ Icon, title, gap, body }) => (
          <div key={title} className="flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal">
              <Icon size={21} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold">
                {title}
                <span className="ml-2 text-[12px] font-medium text-muted">× {gap}</span>
              </p>
              <p className="text-[13px] text-muted">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <Link href="/create" className={`${primaryButton} mt-8`}>
        ルームを作成
        <ChevronRight size={20} />
      </Link>

      <div className="mt-6 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <p className="text-[14px] font-bold">招待されたルームに参加</p>
        <div className="mt-2.5 flex gap-2">
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="招待URL またはルームID"
            className="min-w-0 flex-1 rounded-xl border border-line bg-app px-3.5 py-3 text-[15px] outline-none focus:border-teal"
          />
          <button
            type="button"
            disabled={!roomId}
            onClick={() => roomId && router.push(`/join?room=${roomId}`)}
            className="shrink-0 rounded-xl bg-teal px-4 text-[14px] font-bold text-white disabled:opacity-40"
          >
            参加
          </button>
        </div>
      </div>

      {roomBackend.kind === "local" && (
        <p className="mt-6 rounded-xl bg-crown-soft px-4 py-3 text-[12px] leading-relaxed text-ink/80">
          デモモード: 共有サーバー（Supabase）が未設定のため、ルームはこの端末のブラウザ内だけで共有されます。
        </p>
      )}
    </main>
  );
}
