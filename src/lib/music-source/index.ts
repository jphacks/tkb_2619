import { mockMusicSource } from "./mock";
import type { MusicSourceAdapter } from "./types";

// 現状はモックデータを使用。将来 spotifyMusicSource / musicBrainzMusicSource に
// 差し替える場合も呼び出し側（lib/logic/*）のコードは変更不要。
export const musicSource: MusicSourceAdapter = mockMusicSource;

export type { MusicSourceAdapter };
export { MOCK_SONGS, normalizeKey } from "./mock";
