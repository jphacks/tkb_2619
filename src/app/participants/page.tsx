"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_PARTICIPANTS } from "@/lib/mock-participants";
import { GENERATIONS, GENRES, NATIONALITIES } from "@/types";

const genLabel = (id: string) => GENERATIONS.find((g) => g.id === id)?.label ?? id;
const natLabel = (id: string) => NATIONALITIES.find((n) => n.id === id)?.label ?? id;
const genreLabel = (id: string) => GENRES.find((g) => g.id === id)?.label ?? id;

export default function ParticipantsPage() {
  const router = useRouter();
  const scene = useAppStore((s) => s.scene);
  const participants = useAppStore((s) => s.participants);
  const toggleParticipant = useAppStore((s) => s.toggleParticipant);
  const hasHydrated = useAppStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!scene) router.replace("/");
  }, [hasHydrated, scene, router]);

  const selectedIds = new Set(participants.map((p) => p.id));

  if (!hasHydrated) return null;

  return (
    <PageShell
      step="participants"
      title="参加者を選ぼう"
      subtitle="今日集まるメンバーをタップして選択（2人以上）。※モックのため人物選択式です"
    >
      <div className="grid grid-cols-1 gap-3">
        {MOCK_PARTICIPANTS.map((p) => {
          const selected = selectedIds.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggleParticipant(p)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-fuchsia-400 bg-fuchsia-500/15"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span className="text-3xl">{p.emoji}</span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-white">{p.name}</span>
                <span className="block text-xs text-white/60">
                  {genLabel(p.generation)} · {natLabel(p.nationality)} ·{" "}
                  {p.favoriteGenres.map(genreLabel).join("/")}
                </span>
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                  selected ? "border-fuchsia-400 bg-fuchsia-400 text-white" : "border-white/30 text-transparent"
                }`}
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-6">
        <button
          disabled={participants.length < 2}
          onClick={() => router.push("/candidates")}
          className="w-full rounded-full bg-fuchsia-500 py-3.5 text-center font-bold text-white shadow-lg shadow-fuchsia-500/30 transition disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
        >
          {participants.length < 2
            ? `あと${2 - participants.length}人選んでください`
            : `${participants.length}人で曲候補を見る →`}
        </button>
      </div>
    </PageShell>
  );
}
