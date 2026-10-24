"use client";

import { useMemo, useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import type { Song, SwipeDirection } from "@/types";
import { DIRECTION_TO_SCORE, SCORE_LABELS } from "@/types";
import SongCard from "./SongCard";

const SWIPE_THRESHOLD = 90;

function resolveDirection(offsetX: number, offsetY: number): SwipeDirection {
  if (Math.abs(offsetX) > Math.abs(offsetY)) {
    return offsetX > 0 ? "right" : "left";
  }
  return offsetY > 0 ? "down" : "up";
}

function SwipeCard({
  song,
  onResolved,
  isTop,
  forcedExit,
}: {
  song: Song;
  onResolved: (direction: SwipeDirection) => void;
  isTop: boolean;
  forcedExit: SwipeDirection | null;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(null);
  const activeExit = exitDirection ?? forcedExit;

  const rightOpacity = useTransform(x, [20, 140], [0, 1]);
  const leftOpacity = useTransform(x, [-140, -20], [1, 0]);
  const upOpacity = useTransform(y, [-140, -20], [1, 0]);
  const downOpacity = useTransform(y, [20, 140], [0, 1]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    const passedDistance = Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(offset.y) > SWIPE_THRESHOLD;
    const passedVelocity = Math.abs(velocity.x) > 500 || Math.abs(velocity.y) > 500;

    if (passedDistance || passedVelocity) {
      const direction = resolveDirection(offset.x, offset.y);
      setExitDirection(direction);
    }
  };

  const exitTarget = useMemo(() => {
    switch (activeExit) {
      case "right":
        return { x: 500, y: 0 };
      case "left":
        return { x: -500, y: 0 };
      case "up":
        return { x: 0, y: -600 };
      case "down":
        return { x: 0, y: 600 };
      default:
        return undefined;
    }
  }, [activeExit]);

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, y, rotate, zIndex: isTop ? 10 : 1 }}
      drag={isTop}
      dragElastic={0.7}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      animate={exitTarget ? { ...exitTarget, opacity: 0 } : { x: 0, y: 0, opacity: 1 }}
      transition={exitTarget ? { duration: 0.35, ease: "easeOut" } : { type: "spring", stiffness: 300, damping: 25 }}
      onDragEnd={isTop ? handleDragEnd : undefined}
      onAnimationComplete={() => {
        if (activeExit) onResolved(activeExit);
      }}
    >
      <SongCard song={song}>
        {isTop && (
          <>
            <motion.div
              style={{ opacity: rightOpacity }}
              className="pointer-events-none absolute top-6 right-4 rotate-[-12deg] rounded-lg border-4 border-emerald-400 px-3 py-1 text-xl font-black text-emerald-400"
            >
              {SCORE_LABELS[DIRECTION_TO_SCORE.right]}
            </motion.div>
            <motion.div
              style={{ opacity: leftOpacity }}
              className="pointer-events-none absolute top-6 left-4 rotate-[12deg] rounded-lg border-4 border-slate-300 px-3 py-1 text-xl font-black text-slate-200"
            >
              {SCORE_LABELS[DIRECTION_TO_SCORE.left]}
            </motion.div>
            <motion.div
              style={{ opacity: upOpacity }}
              className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg border-4 border-sky-300 px-3 py-1 text-xl font-black text-sky-200"
            >
              {SCORE_LABELS[DIRECTION_TO_SCORE.up]}
            </motion.div>
            <motion.div
              style={{ opacity: downOpacity }}
              className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-4 border-rose-300 px-3 py-1 text-xl font-black text-rose-200"
            >
              {SCORE_LABELS[DIRECTION_TO_SCORE.down]}
            </motion.div>
          </>
        )}
      </SongCard>
    </motion.div>
  );
}

export default function SwipeDeck({
  songs,
  onSwipe,
  onComplete,
}: {
  songs: Song[];
  onSwipe: (song: Song, direction: SwipeDirection) => void;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [forcedExit, setForcedExit] = useState<SwipeDirection | null>(null);

  if (index >= songs.length) {
    return null;
  }

  const visible = songs.slice(index, index + 3);

  const handleResolved = (song: Song, direction: SwipeDirection) => {
    onSwipe(song, direction);
    const next = index + 1;
    setIndex(next);
    setForcedExit(null);
    if (next >= songs.length) onComplete();
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative mx-auto h-[420px] w-full max-w-sm">
        {visible
          .map((song, i) => (
            <SwipeCard
              key={song.id}
              song={song}
              isTop={i === 0}
              forcedExit={i === 0 ? forcedExit : null}
              onResolved={(direction) => handleResolved(song, direction)}
            />
          ))
          .reverse()}
      </div>
      <div className="grid grid-cols-4 gap-3 text-xs font-semibold text-white/80">
        <button
          type="button"
          onClick={() => setForcedExit("left")}
          className="rounded-xl bg-white/10 py-2.5 transition hover:bg-white/20"
        >
          ⬅️ 知ってる
        </button>
        <button
          type="button"
          onClick={() => setForcedExit("down")}
          className="rounded-xl bg-white/10 py-2.5 transition hover:bg-white/20"
        >
          ⬇️ 興味ない
        </button>
        <button
          type="button"
          onClick={() => setForcedExit("up")}
          className="rounded-xl bg-white/10 py-2.5 transition hover:bg-white/20"
        >
          ⬆️ 好き
        </button>
        <button
          type="button"
          onClick={() => setForcedExit("right")}
          className="rounded-xl bg-fuchsia-500/80 py-2.5 transition hover:bg-fuchsia-500"
        >
          ➡️ 大好き
        </button>
      </div>
    </div>
  );
}
