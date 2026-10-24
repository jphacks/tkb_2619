"use client";

import { useRouter } from "next/navigation";
import { SCENES, type Scene } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import PageShell from "@/components/PageShell";

export default function HomePage() {
  const router = useRouter();
  const setScene = useAppStore((s) => s.setScene);

  const handleSelect = (scene: Scene) => {
    setScene(scene);
    router.push("/participants");
  };

  return (
    <PageShell
      step="scene"
      title="音楽で距離を縮めよう"
      subtitle="今日はどんなシーン？選ぶと最適な選曲フローが始まります。"
    >
      <div className="flex flex-col gap-4">
        {SCENES.map((scene) => (
          <button
            key={scene.id}
            onClick={() => handleSelect(scene.id)}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-fuchsia-400/60 hover:bg-white/10"
          >
            <span className="text-4xl">{scene.emoji}</span>
            <span className="flex-1">
              <span className="block text-lg font-bold text-white">{scene.label}</span>
              <span className="block text-sm text-white/60">{scene.description}</span>
            </span>
            <span className="text-white/40 transition group-hover:translate-x-1 group-hover:text-fuchsia-300">
              →
            </span>
          </button>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-white/40">
        JPHACKS MVP · 共通曲抽出 × スワイプ投票 × 属性レコメンド
      </p>
    </PageShell>
  );
}
