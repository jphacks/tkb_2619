"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from "framer-motion";
import { Play } from "lucide-react";
import type { Song, SwipeDirection } from "@/types";
import { SWIPE_SCORES } from "@/types";
import SongArtwork from "./SongArtwork";

const THRESHOLD = 80;
const EXIT: Record<SwipeDirection, { x: number; y: number }> = {
  up: { x: 0, y: -520 },
  right: { x: 420, y: 0 },
  down: { x: 0, y: 520 },
  left: { x: -420, y: 0 },
};

function resolveDirection(info: PanInfo): SwipeDirection | null {
  const { offset, velocity } = info;
  const far = Math.abs(offset.x) > THRESHOLD || Math.abs(offset.y) > THRESHOLD;
  const fast = Math.abs(velocity.x) > 500 || Math.abs(velocity.y) > 500;
  if (!far && !fast) return null;
  if (Math.abs(offset.x) > Math.abs(offset.y)) return offset.x > 0 ? "right" : "left";
  return offset.y > 0 ? "down" : "up";
}

const BADGE_STYLE: Record<SwipeDirection, string> = {
  up: "border-best text-best",
  right: "border-better text-better",
  down: "border-meh text-meh",
  left: "border-no text-no",
};

/** スワイプで評価するカード。ボタン操作のときは forced に方向を渡すと同じアニメーションで飛んでいく */
export default function VoteCard({
  song,
  forced,
  onDone,
  onPlay,
}: {
  song: Song;
  forced: SwipeDirection | null;
  onDone: (direction: SwipeDirection) => void;
  onPlay: () => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const badgeOpacity: Record<SwipeDirection, MotionValue<number>> = {
    up: useTransform(y, [-120, -30], [1, 0]),
    right: useTransform(x, [30, 120], [0, 1]),
    down: useTransform(y, [30, 120], [0, 1]),
    left: useTransform(x, [-120, -30], [1, 0]),
  };
  const opacity = useMotionValue(1);
  const leaving = useRef(false);
  const finished = useRef(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // 飛ばすアニメーションはここで直接動かし、終わってから評価を確定する。
  // 宣言的な animate プロップだと、ドラッグ終了時にライブラリが始める「元の位置へ戻る」動きと競合し、
  // 評価が確定しないことがあった
  const fly = (direction: SwipeDirection) => {
    if (leaving.current) return;
    leaving.current = true;
    setIsLeaving(true);
    // 端末が重くてアニメーションが遅れても、評価は一定時間で必ず確定させる
    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      onDone(direction);
    };
    const ease = { duration: 0.3, ease: "easeIn" } as const;
    animate(x, EXIT[direction].x, ease);
    animate(y, EXIT[direction].y, ease);
    animate(opacity, 0, { ...ease, onComplete: finish });
    setTimeout(finish, 350);
  };

  useEffect(() => {
    if (forced) fly(forced);
    // forced が変わったときだけ動かす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forced]);

  const handleDragEnd = (info: PanInfo) => {
    const direction = resolveDirection(info);
    if (direction) {
      fly(direction);
      return;
    }
    const spring = { type: "spring", stiffness: 320, damping: 26 } as const;
    animate(x, 0, spring);
    animate(y, 0, spring);
  };

  return (
    <motion.div
      className="relative z-10 w-full cursor-grab touch-none select-none rounded-[22px] bg-surface p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.10)] active:cursor-grabbing"
      style={{ x, y, rotate, opacity }}
      drag={!isLeaving}
      dragMomentum={false}
      onDragEnd={(_, info) => handleDragEnd(info)}
    >
      <div className="relative">
        <SongArtwork song={song} className="aspect-square w-full rounded-xl" />
        <button
          type="button"
          aria-label="試聴"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onClick={onPlay}
          // 中央に置くと指が最初に触れる場所をふさいでスワイプできないため、右下の隅に置く
          className="absolute bottom-2.5 right-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent"
        >
          <Play size={20} fill="currentColor" className="ml-0.5" />
        </button>
        {(Object.keys(badgeOpacity) as SwipeDirection[]).map((dir) => (
          <motion.span
            key={dir}
            style={{ opacity: badgeOpacity[dir] }}
            className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg border-[3px] bg-surface/90 px-3 py-1 text-[18px] font-black ${BADGE_STYLE[dir]}`}
          >
            {SWIPE_SCORES[dir].label}
          </motion.span>
        ))}
      </div>
      <p className="mt-3 truncate text-center text-[19px] font-bold">{song.title}</p>
      <p className="truncate text-center text-[13px] text-muted">{song.artist}</p>
    </motion.div>
  );
}
