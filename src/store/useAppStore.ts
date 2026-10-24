import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CandidateSong, Participant, Scene, Song, Vote } from "@/types";

interface AppState {
  scene: Scene | null;
  participants: Participant[];
  submittedSongs: Song[];
  candidates: CandidateSong[];
  votes: Vote[];
  currentVoterId: string | null;
  /** localStorageからの復元（zustand persist）が完了したか。完了前は画面遷移ガードを走らせない */
  hasHydrated: boolean;

  setHasHydrated: (hydrated: boolean) => void;
  setScene: (scene: Scene) => void;
  toggleParticipant: (participant: Participant) => void;
  setParticipants: (participants: Participant[]) => void;
  addSubmittedSong: (song: Song) => void;
  setCandidates: (candidates: CandidateSong[]) => void;
  setCurrentVoterId: (id: string | null) => void;
  castVote: (vote: Vote) => void;
  resetVotes: () => void;
  resetAll: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      scene: null,
      participants: [],
      submittedSongs: [],
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

      setParticipants: (participants) => set({ participants }),

      addSubmittedSong: (song) => set({ submittedSongs: [...get().submittedSongs, song] }),

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
          submittedSongs: [],
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
