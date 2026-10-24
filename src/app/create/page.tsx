"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { AppHeader, primaryButton } from "@/components/ui";
import { roomBackend } from "@/lib/room";
import { saveIdentity } from "@/lib/room/identity";
import { BASE_PATH } from "@/lib/config";
import {
  AGE_GROUPS,
  GENDER_PREFS,
  GENRES,
  NATIONALITIES,
  SCENES,
  type Room,
  type RoomConditions,
  type Scene,
} from "@/types";

function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <div className="border-t border-line py-3.5">
      <label className="grid grid-cols-[84px_1fr] items-center gap-3">
        <span className="text-[16px] font-bold">{label}</span>
        <span className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value as T)}
            className="w-full appearance-none rounded-xl border border-line bg-white py-3 pl-4 pr-10 text-[16px] outline-none focus:border-teal"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        </span>
      </label>
      {hint && <p className="mt-1.5 pl-[96px] text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

const ANY = { id: "any" as const, label: "指定なし" };

export default function CreateRoomPage() {
  const router = useRouter();
  const [scene, setScene] = useState<Scene>("karaoke");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [conditions, setConditions] = useState<RoomConditions>({
    gender: "any",
    genre: "any",
    nationality: "any",
    ageGroup: "any",
    other: "",
  });
  const [room, setRoom] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof RoomConditions>(key: K, value: RoomConditions[K]) =>
    setConditions((c) => ({ ...c, [key]: value }));

  const inviteUrl = room ? `${window.location.origin}${BASE_PATH}/join?room=${room.id}` : "";
  const sceneInfo = SCENES.find((s) => s.id === scene)!;

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await roomBackend.createRoom({ scene, aiEnabled, conditions });
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
          <div className="pb-3.5">
            <p className="text-[16px] font-bold">シーン</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SCENES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScene(s.id)}
                  disabled={Boolean(room)}
                  className={`rounded-xl border px-2 py-2.5 text-center transition ${
                    s.id === scene ? "border-teal bg-teal-soft" : "border-line bg-white"
                  }`}
                >
                  <span className="block text-[14px] font-bold">{s.label}</span>
                  <span className="block text-[10px] text-muted">{s.gap}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-4">
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
              <SelectRow label="性別" value={conditions.gender} options={[ANY, ...GENDER_PREFS]} onChange={(v) => set("gender", v)} />
              <SelectRow label="ジャンル" value={conditions.genre} options={[ANY, ...GENRES.filter((g) => g.id !== "other")]} onChange={(v) => set("genre", v)} />
              <SelectRow label="国籍" value={conditions.nationality} options={[ANY, ...NATIONALITIES]} onChange={(v) => set("nationality", v)} />
              <SelectRow
                label="年代"
                value={conditions.ageGroup}
                options={[ANY, ...AGE_GROUPS]}
                onChange={(v) => set("ageGroup", v)}
                hint={AGE_GROUPS.map((a) => a.label).join(" / ")}
              />
              <div className="grid grid-cols-[84px_1fr] gap-3 border-t border-line py-3.5">
                <span className="pt-3 text-[16px] font-bold">その他</span>
                <textarea
                  value={conditions.other}
                  onChange={(e) => set("other", e.target.value)}
                  placeholder={sceneInfo.otherPlaceholder}
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
