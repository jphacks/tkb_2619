"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Car, Mic, PartyPopper } from "lucide-react";
import { primaryButton } from "@/components/ui";
import { roomBackend } from "@/lib/room";

// 例はあくまで使い方のヒント。ルームの相手を限定するものではない
const SCENES = [
  { Icon: Mic, title: "カラオケ", example: "上司や先輩など、世代が違う人と" },
  { Icon: PartyPopper, title: "パーティー", example: "留学生など、国籍が違う人と" },
  { Icon: Car, title: "ドライブ", example: "好きな音楽ジャンルが違う人と" },
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
      <h1 className="font-display text-[42px] leading-none text-accent">Musiconnect</h1>
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

      <p className="mt-8 text-[13px] text-muted">たとえば、こんなときに</p>
      <ul className="mt-3 flex flex-col gap-4">
        {SCENES.map(({ Icon, title, example }) => (
          <li key={title} className="flex items-start gap-3">
            <Icon size={26} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="text-[19px] font-bold leading-tight">{title}</p>
              <p className="mt-1 text-[14px] text-muted">{example}</p>
            </div>
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
