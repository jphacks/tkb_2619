"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from "framer-motion";
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
  const [dragged, setDragged] = useState<SwipeDirection | null>(null);
  const active = dragged ?? forced;

  return (
    <motion.div
      className="relative z-10 w-full cursor-grab touch-none rounded-[22px] bg-surface p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.10)] active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag={!active}
      dragElastic={0.8}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      animate={active ? { ...EXIT[active], opacity: 0 } : { x: 0, y: 0, opacity: 1 }}
      transition={active ? { duration: 0.3, ease: "easeIn" } : { type: "spring", stiffness: 320, damping: 26 }}
      onDragEnd={(_, info) => setDragged(resolveDirection(info))}
      onAnimationComplete={() => active && onDone(active)}
    >
      <div className="relative">
        <SongArtwork song={song} className="aspect-square w-full rounded-xl" />
        <button
          type="button"
          aria-label="試聴"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onClick={onPlay}
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink shadow-md"
        >
          <Play size={24} fill="currentColor" className="ml-1" />
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
