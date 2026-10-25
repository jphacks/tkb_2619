"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { SwipeDirection } from "@/types";
import { SWIPE_SCORES } from "@/types";

export interface Reaction {
  /** 同じ評価が続いても毎回出し直すための連番 */
  id: number;
  direction: SwipeDirection;
}

const COLOR: Record<SwipeDirection, string> = {
  up: "text-best",
  right: "text-better",
  down: "text-meh",
  left: "text-no",
};

/** 評価した直後に「Better!」などを大きく出す。カードの上に重ね、少しはずんで消える */
export default function SwipeReaction({ reaction }: { reaction: Reaction | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <AnimatePresence>
        {reaction && (
          <motion.p
            key={reaction.id}
            initial={{ opacity: 0, scale: 0.5, rotate: -8 }}
            animate={{ opacity: 1, scale: [0.5, 1.15, 1], rotate: -6 }}
            exit={{ opacity: 0, scale: 1.25, y: -24 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`font-display text-[56px] leading-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] ${COLOR[reaction.direction]}`}
          >
            {SWIPE_SCORES[reaction.direction].label}!
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
