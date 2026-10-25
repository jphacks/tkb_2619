"use client";

/**
 * iPhone（Safari）は、タップした直後に play() した audio でないと音を出せない。
 * 試聴URLを探している間（await の後）に play() すると、タップ直後と見なされず黙って失敗する。
 * そこで、タップした瞬間に同じ audio で無音を再生しておく。一度タップで鳴らした audio は、あとから曲を差し替えても再生できる。
 */

let silentSrc: string | null = null;

/** 0.05秒の無音 WAV（8bit・モノラル・8kHz）。どのブラウザでも再生できる形式にしている */
function silentWav(): string {
  if (silentSrc) return silentSrc;
  const samples = 400;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // モノラル
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8bit PCM の無音は 128
  silentSrc = `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
  return silentSrc;
}

/** タップの処理の中で、試聴URLを待つ前に呼ぶ */
export function unlockAudio(audio: HTMLAudioElement) {
  if (audio.dataset.unlocked) return;
  audio.dataset.unlocked = "1";
  audio.src = silentWav();
  void audio.play().catch(() => undefined);
}

/** いま入っているのが無音か（無音の再生終了を「曲が終わった」と扱わないため） */
export function isSilent(audio: HTMLAudioElement): boolean {
  return silentSrc !== null && audio.src === silentSrc;
}
