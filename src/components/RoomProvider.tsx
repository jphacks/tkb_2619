"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Member, RoomSnapshot } from "@/types";
import { roomBackend } from "@/lib/room";
import { useRoomIdentity } from "@/lib/room/identity";
import { CATALOG } from "@/lib/music-source";
import { applyArtistMeta, lookupArtistMeta } from "@/lib/music-source/musicbrainz";
import { canonicalArtist, normalizeKey } from "@/lib/music-source/normalize";
import { recommendForRoom, type Recommendation } from "@/lib/logic/recommend";
import { buildCandidatePool, rankWithVotes, voteDeck, type PoolItem, type RankedItem } from "@/lib/logic/ranking";
import { requestGeminiPicks } from "@/lib/logic/gemini";
import { Spinner } from "./ui";

export interface RoomView {
  roomId: string;
  snapshot: RoomSnapshot;
  me: Member;
  isHost: boolean;
  aiRecommendations: Recommendation[];
  pool: PoolItem[];
  deck: PoolItem[];
  ranking: RankedItem[];
  updatedAt: number;
  refresh: () => void;
}

const RoomContext = createContext<RoomView | null>(null);

export function useRoom(): RoomView {
  const view = useContext(RoomContext);
  if (!view) throw new Error("useRoom は RoomProvider の内側で使ってください");
  return view;
}

type LoadState =
  | { roomId: string; status: "ready"; snapshot: RoomSnapshot; updatedAt: number }
  | { roomId: string; status: "missing" | "error" };

/** ルームの最新状態を取得し、変更があれば取り直す（Supabase Realtime / 同一ブラウザ内の通知） */
function useRoomSnapshot(roomId: string | null) {
  const [state, setState] = useState<LoadState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      roomBackend
        .fetchSnapshot(roomId)
        .then((snapshot) => {
          if (cancelled) return;
          setState(
            snapshot ? { roomId, status: "ready", snapshot, updatedAt: Date.now() } : { roomId, status: "missing" }
          );
        })
        .catch(() => !cancelled && setState({ roomId, status: "error" }));
    load();
    const unsubscribe = roomBackend.subscribe(roomId, () => {
      clearTimeout(timer);
      timer = setTimeout(load, 150);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [roomId, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { state: state?.roomId === roomId ? state : null, refresh };
}

/** 自分が持ち込んだ曲のジャンル・国を、アーティスト単位でMusicBrainzから補完する */
function useMetadataEnrichment(snapshot: RoomSnapshot | null, memberId: string | null) {
  const running = useRef(false);
  const [tick, setTick] = useState(0);
  const pending = useMemo(
    () => snapshot?.candidates.filter((c) => c.memberId === memberId && c.song.metaStatus === "pending") ?? [],
    [snapshot, memberId]
  );

  useEffect(() => {
    if (!snapshot || !memberId || pending.length === 0 || running.current) return;
    running.current = true;
    const first = pending[0].song;
    const artist = canonicalArtist(first.artist);
    const sameArtist = pending.filter((c) => canonicalArtist(c.song.artist) === artist).map((c) => c.song);
    lookupArtistMeta(first.artist, first.mbArtistId)
      .catch(() => null)
      .then((meta) => roomBackend.updateCandidateSongs(snapshot.room.id, memberId, sameArtist.map((s) => applyArtistMeta(s, meta))))
      .catch(() => undefined)
      .finally(() => {
        running.current = false;
        setTick((t) => t + 1);
      });
  }, [snapshot, memberId, pending, tick]);
}

function Message({ title, body, roomId }: { title: string; body: string; roomId?: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="text-lg font-bold">{title}</p>
      <p className="text-sm leading-relaxed text-muted">{body}</p>
      <Link href={roomId ? `/join?room=${roomId}` : "/"} className="mt-2 text-sm font-bold text-accent underline">
        {roomId ? "参加画面へ" : "トップへ戻る"}
      </Link>
    </div>
  );
}

const GEMINI_DEBOUNCE_MS = 5_000;
const geminiStorageKey = (roomId: string) => `musicconnect-gemini-${roomId}`;

/**
 * ホストの端末だけが Gemini に候補を選ばせ、ルームに保存して全員で共有する
 * （各端末で別々に呼ぶと、人によって候補が変わってしまうため）。
 * 持ち込まれた曲か条件が変わったときだけ呼ぶ。失敗してもカタログからのおすすめはそのまま使える。
 */
function useGeminiPicks(snapshot: RoomSnapshot | null, memberId: string | null, isHost: boolean) {
  const latest = useRef(snapshot);
  useEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);
  const running = useRef(false);

  const enabled = Boolean(snapshot?.room.aiEnabled) && isHost && memberId !== null && roomBackend.kind === "supabase";
  const signature = useMemo(() => {
    if (!snapshot) return null;
    const brought = snapshot.candidates.filter((c) => c.source !== "ai").map((c) => normalizeKey(c.song));
    return JSON.stringify([snapshot.room.conditions, [...new Set(brought)].sort()]);
  }, [snapshot]);

  useEffect(() => {
    const roomId = latest.current?.room.id;
    if (!enabled || !signature || !roomId || !memberId) return;
    if (readSession(geminiStorageKey(roomId)) === signature) return;

    const timer = setTimeout(async () => {
      const current = latest.current;
      if (running.current || !current) return;
      running.current = true;
      try {
        const picks = await requestGeminiPicks(current.room, current.candidates);
        const existing = current.candidates.filter((c) => c.source === "ai").length;
        await roomBackend.addCandidates(
          picks.map((song, i) => ({
            roomId,
            memberId,
            songId: song.id,
            song,
            source: "ai" as const,
            // 先に選ばれた曲ほど上（0〜1）。後から追加された分は少し下げて並べる
            weight: Math.max(0.3, 1 - (existing + i) * 0.02),
          }))
        );
        writeSession(geminiStorageKey(roomId), signature);
      } catch (error) {
        console.warn("Geminiのおすすめを取得できませんでした（カタログのおすすめを使います）", error);
      } finally {
        running.current = false;
      }
    }, GEMINI_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, signature, memberId]);
}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // プライベートモード等では保存できないが、次に呼ぶだけ
  }
}

export default function RoomProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const roomId = useSearchParams().get("room");
  const identity = useRoomIdentity(roomId);
  const { state, refresh } = useRoomSnapshot(roomId);

  const snapshot = state?.status === "ready" ? state.snapshot : null;
  const me = snapshot?.members.find((m) => m.id === identity?.memberId) ?? null;
  useMetadataEnrichment(snapshot, me?.id ?? null);
  const isHost = Boolean(snapshot && me && (snapshot.room.hostMemberId === me.id || identity?.isHost));
  useGeminiPicks(snapshot, me?.id ?? null, isHost);

  const notJoined = identity !== undefined && snapshot !== null && !me;
  useEffect(() => {
    if (notJoined && roomId) router.replace(`/join?room=${roomId}`);
  }, [notJoined, roomId, router]);

  const view = useMemo<RoomView | null>(() => {
    if (!snapshot || !me || !roomId || state?.status !== "ready") return null;
    // 投票は件数で区切らないので、条件に合う曲はすべて候補に入れる（並びは合う順）
    const aiRecommendations = recommendForRoom(snapshot.room, snapshot.candidates, CATALOG, CATALOG.length);
    const pool = buildCandidatePool(snapshot, aiRecommendations);
    return {
      roomId,
      snapshot,
      me,
      isHost,
      aiRecommendations,
      pool,
      deck: voteDeck(pool),
      ranking: rankWithVotes(pool, snapshot.votes),
      updatedAt: state.updatedAt,
      refresh,
    };
  }, [snapshot, me, roomId, state, isHost, refresh]);

  if (!roomId) return <Message title="ルームが指定されていません" body="招待URLをもう一度開いてください。" />;
  if (state?.status === "missing")
    return (
      <Message
        title="ルームが見つかりません"
        body={
          roomBackend.kind === "local"
            ? "いまはデモモード（この端末のブラウザ内だけで共有）です。別の端末で作ったルームには参加できません。"
            : "招待URLが正しいか確認してください。"
        }
      />
    );
  if (state?.status === "error")
    return <Message title="読み込みに失敗しました" body="通信状況を確認して、ページを再読み込みしてください。" />;
  if (!view) return <Spinner label="ルームを読み込み中…" />;

  return <RoomContext.Provider value={view}>{children}</RoomContext.Provider>;
}
