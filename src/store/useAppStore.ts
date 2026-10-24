import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CandidateSong, Participant, Scene, Song, Vote } from "@/types";

/** Spotifyから取り込んだ直後で、属性（世代・国籍・好きなジャンル）の入力待ちの参加者 */
export interface PendingSpotifyImport {
  spotifyUserId: string;
  displayName: string;
  songIds: string[];
}

interface AppState {
  scene: Scene | null;
  participants: Participant[];
  /** Spotifyから取り込んだ曲（参加者の knownSongIds から参照される） */
  importedSongs: Song[];
  submittedSongs: Song[];
  pendingImport: PendingSpotifyImport | null;
  candidates: CandidateSong[];
  votes: Vote[];
  currentVoterId: string | null;
  /** localStorageからの復元（zustand persist）が完了したか。完了前は画面遷移ガードを走らせない */
  hasHydrated: boolean;

  setHasHydrated: (hydrated: boolean) => void;
  setScene: (scene: Scene) => void;
  toggleParticipant: (participant: Participant) => void;
  upsertParticipant: (participant: Participant) => void;
  removeParticipant: (id: string) => void;
  setPendingImport: (pending: PendingSpotifyImport, songs: Song[]) => void;
  clearPendingImport: () => void;
  addSubmittedSong: (song: Song) => void;
  /** MusicBrainzで補完した曲情報を反映する */
  updateSong: (song: Song) => void;
  setCandidates: (candidates: CandidateSong[]) => void;
  setCurrentVoterId: (id: string | null) => void;
  castVote: (vote: Vote) => void;
  resetVotes: () => void;
  resetAll: () => void;
}

function mergeById(existing: Song[], incoming: Song[]): Song[] {
  const ids = new Set(existing.map((s) => s.id));
  return [...existing, ...incoming.filter((s) => !ids.has(s.id))];
}

/** どの参加者からも・入力待ちの取り込みからも参照されなくなった取り込み曲を捨てる */
function pruneImportedSongs(songs: Song[], participants: Participant[], pending: PendingSpotifyImport | null) {
  const used = new Set([...participants.flatMap((p) => p.knownSongIds), ...(pending?.songIds ?? [])]);
  return songs.filter((s) => used.has(s.id));
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      scene: null,
      participants: [],
      importedSongs: [],
      submittedSongs: [],
      pendingImport: null,
      candidates: [],
      votes: [],
      currentVoterId: null,
      hasHydrated: false,

      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

      setScene: (scene) => set({ scene }),

      toggleParticipant: (participant) => {
        const exists = get().participants.some((p) => p.id === participant.id);
        set({
          participants: exists
            ? get().participants.filter((p) => p.id !== participant.id)
            : [...get().participants, participant],
        });
      },

      upsertParticipant: (participant) => {
        const others = get().participants.filter((p) => p.id !== participant.id);
        const participants = [...others, participant];
        set({ participants, importedSongs: pruneImportedSongs(get().importedSongs, participants, get().pendingImport) });
      },

      removeParticipant: (id) => {
        const participants = get().participants.filter((p) => p.id !== id);
        set({
          participants,
          votes: get().votes.filter((v) => v.participantId !== id),
          importedSongs: pruneImportedSongs(get().importedSongs, participants, get().pendingImport),
        });
      },

      setPendingImport: (pending, songs) =>
        set({ pendingImport: pending, importedSongs: mergeById(get().importedSongs, songs) }),

      clearPendingImport: () =>
        set({
          pendingImport: null,
          importedSongs: pruneImportedSongs(get().importedSongs, get().participants, null),
        }),

      addSubmittedSong: (song) => set({ submittedSongs: mergeById(get().submittedSongs, [song]) }),

      updateSong: (song) => {
        const replace = (list: Song[]) => list.map((s) => (s.id === song.id ? song : s));
        set({ importedSongs: replace(get().importedSongs), submittedSongs: replace(get().submittedSongs) });
      },

      setCandidates: (candidates) => set({ candidates }),

      setCurrentVoterId: (id) => set({ currentVoterId: id }),

      castVote: (vote) => {
        const withoutExisting = get().votes.filter(
          (v) => !(v.participantId === vote.participantId && v.songId === vote.songId)
        );
        set({ votes: [...withoutExisting, vote] });
      },

      resetVotes: () => set({ votes: [] }),

      resetAll: () =>
        set({
          scene: null,
          participants: [],
          importedSongs: [],
          submittedSongs: [],
          pendingImport: null,
          candidates: [],
          votes: [],
          currentVoterId: null,
        }),
    }),
    {
      name: "music-bridge-app-state",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
