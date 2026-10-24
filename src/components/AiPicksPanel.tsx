"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { useRoom } from "./RoomProvider";
import { roomBackend } from "@/lib/room";
import { isAiAvailable, requestAiPicks } from "@/lib/ai";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };

/**
 * AI（Gemini）のおすすめ曲。幹事の端末だけがAIを呼び、結果をルームに保存して全員で共有する
 * （参加者全員が呼ぶと、APIの呼び出し回数が人数分に増えてしまうため）。
 */
export default function AiPicksPanel() {
  const { roomId, snapshot, pool, isHost } = useRoom();
  const { room } = snapshot;
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const autoStarted = useRef(false);
  const available = isAiAvailable();

  const generate = async () => {
    setStatus({ kind: "loading" });
    try {
      const picks = await requestAiPicks(snapshot, pool);
      if (picks.length === 0) throw new Error("AIから曲が返ってきませんでした");
      await roomBackend.setAiPicks(roomId, picks);
      setStatus({ kind: "idle" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "不明なエラー" });
    }
  };

  // 幹事がルームを開いたとき、まだAIに聞いていなければ1回だけ自動で聞く
  useEffect(() => {
    if (!isHost || !room.aiEnabled || !available || room.aiPicks.length > 0 || autoStarted.current) return;
    autoStarted.current = true;
    void Promise.resolve().then(generate);
    // 自動実行は最初の1回だけでよいので、generate の作り直しでは再実行しない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, room.aiEnabled, room.aiPicks.length, available]);

  if (!room.aiEnabled) return null;

  const picks = room.aiPicks;
  return (
    <section className="rounded-2xl bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[14px] font-bold">
          <Sparkles size={16} className="text-accent" />
          AIのおすすめ
        </p>
        {isHost && available && (
          <button
            type="button"
            onClick={generate}
            disabled={status.kind === "loading"}
            className="flex items-center gap-1 text-[12px] font-bold text-accent disabled:opacity-50"
          >
            <RefreshCw size={13} className={status.kind === "loading" ? "animate-spin" : ""} />
            {picks.length > 0 ? "AIに聞き直す" : "AIに聞く"}
          </button>
        )}
      </div>

      {status.kind === "loading" ? (
        <p className="mt-2 text-[13px] text-muted">AIがみんなの好みから選曲中…（混んでいると1分ほどかかります）</p>
      ) : picks.length > 0 ? (
        <>
          <p className="mt-2 text-[13px] leading-relaxed">
            {picks
              .slice(0, 3)
              .map((p) => p.song.title)
              .join("、")}
            {picks.length > 3 && ` ほか${picks.length - 3}曲`}を候補に入れました
          </p>
          {isHost && <p className="mt-1 text-[11px] text-muted">人が増えたら「AIに聞き直す」で、みんなの好みに合わせて選び直せます</p>}
        </>
      ) : (
        <p className="mt-2 text-[13px] text-muted">
          {isHost ? "まだAIに聞いていません" : "幹事がAIに聞くと、ここにおすすめが表示されます"}
        </p>
      )}

      {status.kind === "error" && (
        <p className="mt-2 text-[12px] leading-relaxed text-heart">
          AIを使えませんでした（{status.message}）。条件に合う曲をルールで選んで候補に入れています。
        </p>
      )}
      {!available && isHost && (
        <p className="mt-2 text-[12px] text-muted">デモモードではAIは使えません。条件に合う曲をルールで選んでいます。</p>
      )}
    </section>
  );
}
