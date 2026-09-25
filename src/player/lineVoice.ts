// 대사 한 줄에 붙는 음성 파일. 배경음은 건드리지 않고, 다음 줄이나 창이 닫히면 멈춘다.
// 음량은 설정 메뉴의 「대사 목소리」 칸을 쓴다.

import { getPlayerPreferences } from "@/player/playerPreferences";

let current: HTMLAudioElement | undefined;

export function stopLineVoice(): void {
  if (!current) return;
  current.pause();
  current.src = "";
  current = undefined;
}

export function playLineVoice(url: string): void {
  stopLineVoice();
  if (typeof Audio === "undefined") return;
  const volume = getPlayerPreferences().voice;
  if (!(volume > 0)) return;
  const audio = new Audio(url);
  audio.volume = Math.min(1, Math.max(0, volume));
  current = audio;
  const started = audio.play();
  if (typeof started?.then !== "function") return;
  void started.then(
    () => undefined,
    (error: unknown) => {
      if (current !== audio) return;
      if (error instanceof DOMException && error.name === "NotAllowedError") return;
      stopLineVoice();
    },
  );
}
