import type { Member } from "@/types";

// 落ち着いた色だけを使う（原色のアイコンが並ぶと、テンプレートっぽく見えるため）
const COLORS = ["#8a5a3c", "#5c6b4a", "#4f5d75", "#7a4e6b", "#a0643a", "#3f6e6b", "#6b5a8a", "#7a6a3c"];

function colorFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

/** 名前の最初の1文字（「（」などの記号は飛ばす） */
function initialOf(name: string): string {
  const ch = [...name.trim()].find((c) => /[\p{L}\p{N}]/u.test(c));
  return (ch ?? "?").toUpperCase();
}

/** 参加者の頭文字アイコン。自分にはオレンジの輪を付ける */
export default function MemberAvatar({ member, isMe = false, size = 40 }: { member: Member; isMe?: boolean; size?: number }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-ink ${isMe ? "ring-2 ring-accent ring-offset-2 ring-offset-app" : ""}`}
      style={{ width: size, height: size, background: colorFor(member.id), fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {initialOf(member.name)}
    </span>
  );
}
