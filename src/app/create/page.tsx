"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { AppHeader, primaryButton } from "@/components/ui";
import { roomBackend } from "@/lib/room";
import { saveIdentity } from "@/lib/room/identity";
import { BASE_PATH } from "@/lib/config";
import { AGE_GROUPS, EMPTY_CONDITIONS, GENDERS, GENRES, NATIONALITIES, type Room, type RoomConditions } from "@/types";

/**
 * 集団の属性を選ぶ行（複数選択。何も選ばなければ指定なし）。
 * 選択肢が多い行は、よく使うものだけ（visible 個）を先に出し、残りは「ほか○」で開く。選んだものは常に見せる
 */
function ChipRow<T extends string>({
  label,
  selected,
  options,
  onChange,
  visible = options.length,
}: {
  label: string;
  selected: T[];
  options: { id: T; label: string }[];
  onChange: (next: T[]) => void;
  visible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = (id: T) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const shown = expanded ? options : options.filter((o, i) => i < visible || selected.includes(o.id));
  const hidden = options.length - shown.length;
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3 border-t border-line py-3.5">
      <span className="pt-1.5 text-[16px] font-bold">{label}</span>
      <div>
        <div className="flex flex-wrap gap-1.5">
          {shown.map((o) => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o.id)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[14px] transition ${
                  on ? "border-accent bg-accent font-bold text-on-accent" : "border-line bg-surface text-ink"
                }`}
              >
                {on && <Check size={13} strokeWidth={3} />}
                {o.label}
              </button>
            );
          })}
          {(hidden > 0 || expanded) && options.length > visible && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="px-2 py-1.5 text-[13px] text-muted underline">
              {expanded ? "閉じる" : `ほか${hidden}`}
            </button>
          )}
        </div>
        {selected.length > 0 && <p className="mt-1.5 text-[11px] text-muted">{selected.length}つ選択中</p>}
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

  // LINE などの共有シートで送る。共有できないブラウザではコピーにする
  const handleShare = async () => {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: "Musiconnect", text: "選曲ルームに参加してね", url: inviteUrl }).catch(() => undefined);
    } else {
      await handleCopy();
    }
  };

  // 作成後は条件を変えられないので、URLを送ることとルームに入ることだけに絞る
  if (room) {
    return (
      <>
        <AppHeader title="ルームができました" backHref="/" />
        <main className="flex flex-1 flex-col px-5 pb-8 pt-6">
          <p className="text-[22px] font-bold leading-snug">
            招待URLを
            <br />
            みんなに送ろう
          </p>
          <div className="mt-6 flex items-center gap-2 border-y border-line py-3">
            <span className="min-w-0 flex-1 truncate text-[14px] text-muted">{inviteUrl}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1 rounded-lg border-[1.5px] border-accent px-3 py-1.5 text-[13px] font-bold text-accent"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "コピーした" : "コピー"}
            </button>
          </div>
          <button type="button" onClick={handleShare} className="mt-3 self-start py-1 text-[14px] font-bold text-accent">
            LINEなどで送る
          </button>

          <div className="flex-1" />

          <button type="button" onClick={() => router.push(`/join?room=${room.id}`)} className={`${primaryButton} mt-10`}>
            ルームに入る
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader title="ルームを作成" backHref="/" />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-8">
        <section className="pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[18px] font-bold">AIレコメンド</span>
            <div className="grid grid-cols-2 rounded-xl border border-line bg-app p-1">
              {[false, true].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  onClick={() => setAiEnabled(on)}
                  className={`w-[76px] rounded-lg py-2 text-[14px] font-bold transition ${
                    aiEnabled === on ? "bg-accent text-on-accent" : "text-muted"
                  }`}
                >
                  {on ? "ON" : "OFF"}
                </button>
              ))}
            </div>
          </div>
          <div className="pb-3" />

          {aiEnabled && (
            <fieldset>
              <p className="border-t border-line pb-1 pt-3 text-[14px] font-bold">集まる人は？</p>
              <ChipRow label="性別" selected={conditions.genders} options={GENDERS} onChange={(v) => set("genders", v)} />
              <ChipRow
                label="ジャンル"
                selected={conditions.genres}
                options={GENRES.filter((g) => g.id !== "other")}
                visible={6}
                onChange={(v) => set("genres", v)}
              />
              <ChipRow
                label="国籍"
                selected={conditions.nationalities}
                options={NATIONALITIES}
                visible={6}
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
                  className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none placeholder:text-muted/60 focus:border-accent"
                />
              </div>
            </fieldset>
          )}
        </section>

        <button type="button" onClick={handleCreate} disabled={creating} className={primaryButton}>
          {creating ? "作成中…" : "招待URLを作成"}
        </button>
        {error && <p className="text-center text-[13px] text-heart">{error}</p>}
      </main>
    </>
  );
}
