"use client";

import { useSyncExternalStore } from "react";

/** この端末が各ルームで誰として参加しているか（ログインの代わり。端末ごとにlocalStorageへ保存） */
export interface RoomIdentity {
  memberId: string | null;
  isHost: boolean;
}

type IdentityMap = Record<string, RoomIdentity>;

const STORAGE_KEY = "musicconnect-identity-v1";
const listeners = new Set<() => void>();
let cache: IdentityMap | null = null;

function read(): IdentityMap {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as IdentityMap;
  } catch {
    cache = {};
  }
  return cache;
}

export function getIdentity(roomId: string): RoomIdentity | null {
  return read()[roomId] ?? null;
}

export function saveIdentity(roomId: string, patch: Partial<RoomIdentity>) {
  const current = read()[roomId] ?? { memberId: null, isHost: false };
  cache = { ...read(), [roomId]: { ...current, ...patch } };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // プライベートモード等では保存できないが、このタブの間は使える
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** サーバー描画時（静的書き出し時）は undefined、ブラウザでは保存済みの参加情報（なければ null） */
export function useRoomIdentity(roomId: string | null): RoomIdentity | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (roomId ? getIdentity(roomId) : null),
    () => undefined
  );
}
