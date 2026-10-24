"use client";

import Link from "next/link";
import ProgressSteps, { type StepKey } from "./ProgressSteps";
import { useAppStore } from "@/store/useAppStore";
import { SCENES } from "@/types";

export default function PageShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: StepKey;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const scene = useAppStore((s) => s.scene);
  const resetAll = useAppStore((s) => s.resetAll);
  const sceneInfo = SCENES.find((s) => s.id === scene);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-6">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-white/70 hover:text-white">
          🎵 Music Bridge
        </Link>
        {scene && (
          <Link
            href="/"
            onClick={() => resetAll()}
            className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/20"
          >
            やり直す
          </Link>
        )}
      </div>

      <ProgressSteps current={step} />

      <div className="mt-6 mb-2">
        {sceneInfo && (
          <span className="mb-1 inline-block rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">
            {sceneInfo.emoji} {sceneInfo.label}
          </span>
        )}
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
      </div>

      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}
