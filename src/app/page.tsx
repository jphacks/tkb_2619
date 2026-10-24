"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Car, Mic, PartyPopper } from "lucide-react";
import { primaryButton } from "@/components/ui";
import { roomBackend } from "@/lib/room";

const SCENES = [
  { Icon: Mic, title: "カラオケ" },
  { Icon: PartyPopper, title: "パーティー" },
  { Icon: Car, title: "ドライブ" },
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
    <main className="flex flex-1 flex-col px-6 pb-10 pt-16">
      <h1 className="font-display text-[52px] leading-none text-accent">ミューコネ</h1>
      <p className="mt-2 text-[13px] font-bold tracking-[0.2em] text-muted">MusiConnect</p>
      <p className="mt-5 text-[22px] font-bold leading-snug">
        共通の一曲が、
        <br />
        心を繋ぐ。
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-muted">
        みんなが知っている曲、聴きたい曲を
        <br />
        投票で決めよう。
      </p>

      <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[15px] font-bold">
        {SCENES.map(({ Icon, title }) => (
          <li key={title} className="flex items-center gap-1.5">
            <Icon size={18} className="text-accent" />
            {title}
          </li>
        ))}
      </ul>

      <div className="flex-1" />

      <Link href="/create" className={`${primaryButton} mt-10`}>
        ルームを作る
        <ArrowRight size={20} />
      </Link>

      <div className="mt-8 border-t border-line pt-5">
        <p className="text-[13px] text-muted">招待された人はこちら</p>
        <div className="mt-2.5 flex gap-2">
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="招待URL またはルームID"
            className="min-w-0 flex-1 rounded-xl border border-line bg-app px-3.5 py-3 text-[15px] outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={!roomId}
            onClick={() => roomId && router.push(`/join?room=${roomId}`)}
            className="shrink-0 rounded-xl bg-accent px-4 text-[14px] font-bold text-on-accent disabled:opacity-40"
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
