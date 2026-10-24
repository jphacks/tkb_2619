"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Copy } from "lucide-react";
import { AppHeader, primaryButton } from "@/components/ui";
import { roomBackend } from "@/lib/room";
import { saveIdentity } from "@/lib/room/identity";
import { BASE_PATH } from "@/lib/config";
import { AGE_GROUPS, EMPTY_CONDITIONS, GENDERS, GENRES, NATIONALITIES, type Room, type RoomConditions } from "@/types";

/** 集団の属性を選ぶ行（複数選択。何も選ばなければ指定なし） */
function ChipRow<T extends string>({
  label,
  selected,
  options,
  onChange,
}: {
  label: string;
  selected: T[];
  options: { id: T; label: string }[];
  onChange: (next: T[]) => void;
}) {
  const toggle = (id: T) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3 border-t border-line py-3.5">
      <span className="pt-1.5 text-[16px] font-bold">{label}</span>
      <div>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o.id)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[14px] transition ${
                  on ? "border-teal bg-teal font-bold text-white" : "border-line bg-white text-ink"
                }`}
              >
                {on && <Check size={13} strokeWidth={3} />}
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          {selected.length === 0 ? "指定なし（複数選択できます）" : `${selected.length}つ選択中`}
        </p>
      </div>
    </div>
  );
}

export default function CreateRoomPage() {
  const router = useRouter();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [conditions, setConditions] = useState<RoomConditions>(EMPTY_CONDITIONS);
  const [room, setRoom] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof RoomConditions>(key: K, value: RoomConditions[K]) =>
    setConditions((c) => ({ ...c, [key]: value }));

  const inviteUrl = room ? `${window.location.origin}${BASE_PATH}/join?room=${room.id}` : "";

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await roomBackend.createRoom({ aiEnabled, conditions });
      saveIdentity(created.id, { isHost: true });
      setRoom(created);
    } catch {
      setError("ルームを作成できませんでした。通信状況を確認してもう一度お試しください。");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <AppHeader title="ルームを作成" backHref="/" />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-8">
        <section className="rounded-2xl bg-white px-4 pb-1 pt-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[18px] font-bold">AIレコメンド</span>
            <div className="grid grid-cols-2 rounded-xl border border-line bg-app p-1">
              {[false, true].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  onClick={() => setAiEnabled(on)}
                  disabled={Boolean(room)}
                  className={`w-[76px] rounded-lg py-2 text-[14px] font-bold transition ${
                    aiEnabled === on ? "bg-teal text-white" : "text-muted"
                  }`}
                >
                  {on ? "ON" : "OFF"}
                </button>
              ))}
            </div>
          </div>
          <p className="pb-3.5 pt-2 text-[12px] text-muted">AIをOFFにすると条件入力は非表示</p>

          {aiEnabled && (
            <fieldset disabled={Boolean(room)}>
              <p className="border-t border-line pb-1 pt-3 text-[12px] leading-relaxed text-muted">
                集まる人たちの属性を選んでください。複数選ぶと、みんなに届く曲が優先されます。
              </p>
              <ChipRow label="性別" selected={conditions.genders} options={GENDERS} onChange={(v) => set("genders", v)} />
              <ChipRow
                label="ジャンル"
                selected={conditions.genres}
                options={GENRES.filter((g) => g.id !== "other")}
                onChange={(v) => set("genres", v)}
              />
              <ChipRow
                label="国籍"
                selected={conditions.nationalities}
                options={NATIONALITIES}
                onChange={(v) => set("nationalities", v)}
              />
              <ChipRow label="年代" selected={conditions.ageGroups} options={AGE_GROUPS} onChange={(v) => set("ageGroups", v)} />
              <div className="grid grid-cols-[72px_1fr] gap-3 border-t border-line py-3.5">
                <span className="pt-3 text-[16px] font-bold">その他</span>
                <textarea
                  value={conditions.other}
                  onChange={(e) => set("other", e.target.value)}
                  placeholder="みんなで歌える、明るい曲がいい"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none placeholder:text-muted/60 focus:border-teal"
                />
              </div>
            </fieldset>
          )}
        </section>

        {!room ? (
          <button type="button" onClick={handleCreate} disabled={creating} className={primaryButton}>
            <span className="flex-1 pl-6 text-center">{creating ? "作成中…" : "招待URLを作成"}</span>
            <ChevronRight size={22} />
          </button>
        ) : (
          <button type="button" onClick={() => router.push(`/join?room=${room.id}`)} className={primaryButton}>
            <span className="flex-1 pl-6 text-center">ルームに入る</span>
            <ChevronRight size={22} />
          </button>
        )}
        {error && <p className="text-center text-[13px] text-heart">{error}</p>}

        {room && (
          <section className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <span className="shrink-0 text-[14px] font-bold">招待URL</span>
            <span className="min-w-0 flex-1 truncate rounded-lg bg-app px-3 py-2 text-[13px] text-muted">{inviteUrl}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1 rounded-lg border-[1.5px] border-teal px-3 py-1.5 text-[13px] font-bold text-teal"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "済" : "コピー"}
            </button>
          </section>
        )}
        {room && (
          <p className="text-center text-[12px] text-muted">
            URLを参加者に送ってください。あなたも「ルームに入る」から参加できます。
          </p>
        )}
      </main>
    </>
  );
}
