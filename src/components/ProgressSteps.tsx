"use client";

const STEPS = [
  { key: "scene", label: "シーン", href: "/" },
  { key: "participants", label: "参加者", href: "/participants" },
  { key: "candidates", label: "候補", href: "/candidates" },
  { key: "vote", label: "投票", href: "/vote" },
  { key: "results", label: "結果", href: "/results" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export default function ProgressSteps({ current }: { current: StepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center justify-between gap-1 px-1">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.key} className="flex flex-1 items-center gap-1">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                active
                  ? "bg-fuchsia-500 text-white shadow-[0_0_12px_rgba(217,70,239,0.7)]"
                  : done
                  ? "bg-violet-400 text-white"
                  : "bg-white/10 text-white/50"
              }`}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 rounded ${done ? "bg-violet-400" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
