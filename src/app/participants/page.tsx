"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import { useAppStore, type PendingSpotifyImport } from "@/store/useAppStore";
import { MOCK_PARTICIPANTS } from "@/lib/mock-participants";
import { startSpotifyLogin } from "@/lib/music-source/spotify";
import {
  GENERATIONS,
  GENRES,
  NATIONALITIES,
  type Generation,
  type Genre,
  type Nationality,
  type Participant,
} from "@/types";

const genLabel = (id: string) => GENERATIONS.find((g) => g.id === id)?.label ?? id;
const natLabel = (id: string) => NATIONALITIES.find((n) => n.id === id)?.label ?? id;
const genreLabel = (id: string) => GENRES.find((g) => g.id === id)?.label ?? id;

const selectClass =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none";

function PendingImportForm({ pending }: { pending: PendingSpotifyImport }) {
  const importedSongs = useAppStore((s) => s.importedSongs);
  const upsertParticipant = useAppStore((s) => s.upsertParticipant);
  const clearPendingImport = useAppStore((s) => s.clearPendingImport);

  const [name, setName] = useState(pending.displayName);
  const [generation, setGeneration] = useState<Generation>("20s");
  const [nationality, setNationality] = useState<Nationality>("JP");
  const [favoriteGenres, setFavoriteGenres] = useState<Genre[]>([]);

  const songs = useMemo(() => {
    const ids = new Set(pending.songIds);
    return importedSongs.filter((s) => ids.has(s.id));
  }, [importedSongs, pending.songIds]);

  // MusicBrainzで補完済みの曲から、よく聴くジャンルを推定してヒントに出す
  const suggestedGenres = useMemo(() => {
    const count = new Map<Genre, number>();
    for (const s of songs) if (s.genre !== "other") count.set(s.genre, (count.get(s.genre) ?? 0) + 1);
    return Array.from(count.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g);
  }, [songs]);
  const enrichedCount = songs.filter((s) => s.metaStatus === "done").length;

  const toggleGenre = (g: Genre) =>
    setFavoriteGenres((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g]));

  const handleAdd = () => {
    const participant: Participant = {
      id: `spotify-${pending.spotifyUserId}`,
      name: name.trim() || pending.displayName,
      emoji: "🎧",
      generation,
      nationality,
      favoriteGenres: favoriteGenres.length > 0 ? favoriteGenres : suggestedGenres,
      knownSongIds: pending.songIds,
      origin: "spotify",
    };
    upsertParticipant(participant);
    clearPendingImport();
  };

  return (
    <div className="mb-6 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 p-4">
      <p className="text-sm font-bold text-white">🎧 Spotifyから{songs.length}曲を取り込みました</p>
      <p className="mt-1 text-xs text-white/60">
        属性を入力して参加者に追加してください（ジャンル情報をMusicBrainzから取得中 {enrichedCount}/{songs.length}）
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="text-xs text-white/70">
          名前
          <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${selectClass}`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-white/70">
            世代
            <select
              value={generation}
              onChange={(e) => setGeneration(e.target.value as Generation)}
              className={`mt-1 ${selectClass}`}
            >
              {GENERATIONS.map((g) => (
                <option key={g.id} value={g.id} className="bg-slate-900">
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-white/70">
            国籍
            <select
              value={nationality}
              onChange={(e) => setNationality(e.target.value as Nationality)}
              className={`mt-1 ${selectClass}`}
            >
              {NATIONALITIES.map((n) => (
                <option key={n.id} value={n.id} className="bg-slate-900">
                  {n.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="text-xs text-white/70">
          好きなジャンル
          {suggestedGenres.length > 0 && (
            <span className="ml-2 text-white/40">
              （未選択なら推定: {suggestedGenres.map(genreLabel).join("/")}）
            </span>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {GENRES.filter((g) => g.id !== "other").map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGenre(g.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  favoriteGenres.includes(g.id)
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                    : "border-white/15 text-white/60 hover:border-white/30"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          className="flex-1 rounded-full bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-400"
        >
          参加者に追加
        </button>
        <button
          type="button"
          onClick={clearPendingImport}
          className="rounded-full bg-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/20"
        >
          取り消す
        </button>
      </div>
    </div>
  );
}

export default function ParticipantsPage() {
  const router = useRouter();
  const scene = useAppStore((s) => s.scene);
  const participants = useAppStore((s) => s.participants);
  const pendingImport = useAppStore((s) => s.pendingImport);
  const toggleParticipant = useAppStore((s) => s.toggleParticipant);
  const removeParticipant = useAppStore((s) => s.removeParticipant);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const [redirecting, setRedirecting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!scene) router.replace("/");
  }, [hasHydrated, scene, router]);

  const selectedIds = new Set(participants.map((p) => p.id));
  const spotifyParticipants = participants.filter((p) => p.origin === "spotify");

  const handleSpotifyLogin = async () => {
    setRedirecting(true);
    setLoginError(null);
    try {
      await startSpotifyLogin();
    } catch {
      setRedirecting(false);
      setLoginError("この環境ではSpotifyログインを開始できません。https のサイトか http://127.0.0.1:3000 で開いてください。");
    }
  };

  if (!hasHydrated) return null;

  return (
    <PageShell
      step="participants"
      title="参加者を選ぼう"
      subtitle="Spotifyで参加するか、プリセットの人物をタップして選択（合計2人以上）"
    >
      {pendingImport ? (
        <PendingImportForm key={pendingImport.spotifyUserId} pending={pendingImport} />
      ) : (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <button
            type="button"
            onClick={handleSpotifyLogin}
            disabled={redirecting}
            className="w-full rounded-full bg-[#1DB954] py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-60"
          >
            {redirecting ? "Spotifyに移動中…" : "🎧 Spotifyで参加（よく聴く曲を取り込む）"}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-white/50">
            ログインした人のよく聴く曲・お気に入り曲を取り込み、共通曲の抽出に使います。1人ずつ順番にログインできます。
            ※開発中のため、Spotify側に登録済みのアカウントのみ利用できます。
          </p>
          {loginError && <p className="mt-2 text-xs text-rose-300">{loginError}</p>}
        </div>
      )}

      {spotifyParticipants.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {spotifyParticipants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-emerald-400/60 bg-emerald-500/10 p-3"
            >
              <span className="text-3xl">{p.emoji}</span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-white">{p.name}</span>
                <span className="block text-xs text-white/60">
                  {genLabel(p.generation)} · {natLabel(p.nationality)} · Spotifyから{p.knownSongIds.length}曲
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeParticipant(p.id)}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/20"
              >
                外す
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mb-2 text-xs font-semibold text-white/50">プリセットの人物</p>
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
