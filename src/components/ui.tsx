"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChartColumn, ChevronLeft, Heart, Music } from "lucide-react";

export function AppHeader({ title, backHref }: { title: string; backHref?: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 grid h-14 grid-cols-[48px_1fr_48px] items-center bg-app/95 px-2 backdrop-blur">
      <button
        type="button"
        aria-label="戻る"
        onClick={() => (backHref ? router.push(backHref) : router.back())}
        className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-ink/10"
      >
        <ChevronLeft size={24} />
      </button>
      <h1 className="truncate text-center text-[17px] font-bold">{title}</h1>
      <span />
    </header>
  );
}

export type RoomTab = "add" | "vote" | "results";

const TABS: { id: RoomTab; label: string; path: string; Icon: typeof Music }[] = [
  { id: "add", label: "手動", path: "/room/add", Icon: Music },
  { id: "vote", label: "投票", path: "/room/vote", Icon: Heart },
  { id: "results", label: "結果", path: "/room/results", Icon: ChartColumn },
];

export function TabBar({ roomId, active }: { roomId: string; active?: RoomTab }) {
  return (
    <nav className="sticky bottom-0 z-20 mt-auto grid grid-cols-3 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {TABS.map(({ id, label, path, Icon }) => {
        const on = id === active;
        return (
          <Link
            key={id}
            href={`${path}?room=${roomId}`}
            className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              on ? "text-accent" : "text-muted"
            }`}
          >
            <Icon size={22} strokeWidth={on ? 2.4 : 1.8} />
            {label}
            {on && <span className="absolute bottom-0 h-[3px] w-12 rounded-full bg-accent" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function SpotifyLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="currentColor" />
      <path
        d="M6.5 9.4c3.7-1.1 7.9-.8 11.2 1M7.1 12.5c3-.8 6.4-.5 9.1 1M7.7 15.4c2.4-.6 4.9-.4 7 .8"
        stroke="var(--color-spotify)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-[16px] font-bold text-on-accent shadow-sm transition hover:bg-accent-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

/** Spotify連携ボタン。Spotifyのブランドカラーにして、アプリのオレンジのボタンと区別する */
export const spotifyButton =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-spotify px-5 py-4 text-[16px] font-bold text-on-spotify shadow-sm transition hover:bg-spotify-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

export const outlineButton =
  "flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-accent/70 bg-surface px-5 py-3.5 text-[15px] font-bold text-ink transition hover:bg-accent-soft active:scale-[0.99] disabled:opacity-50";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-sm text-muted">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-accent/20 border-t-accent" />
      {label}
    </div>
  );
}
