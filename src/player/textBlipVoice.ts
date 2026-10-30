// 대사 글자음(textBlip 자리) — 프로젝트 자리 표(project.system.seCues.textBlip)에 걸린 짧은 소리를 글자가 나올 때 낸다.
//
// 계약(2026-10-31): 자리가 비어 있으면 조용한 플레이어(옛 게임은 바뀌지 않는다). 화자에 저작한 합성 목소리(look.voice)와
// 녹음 음성(voiceResourceId)이 있으면 그쪽이 먼저다(dialogue.ts dialogueVoiceFor). 공백·문장부호는 건너뛰고,
// 소리 내는 글자 둘 중 하나만, 최소 간격 TEXT_BLIP_MIN_GAP_MS 안에는 한 번만 — 빠른 대사에서 윙윙거리지 않게.
// 크기는 효과음 채널(설정 「효과음」) × TEXT_BLIP_VOLUME.
import { playAudioCommand } from "@/player/audio";
import { isVoicedChar, type DialogueVoicePlayer } from "@/player/dialogueVoice";
import { projectSeCue } from "@/project/seCues";
import type { Project } from "@/project/types";

export const TEXT_BLIP_MIN_GAP_MS = 55;
export const TEXT_BLIP_VOLUME = 60;

export function createTextBlipVoice(project: Project | undefined, now: () => number = () => performance.now()): DialogueVoicePlayer | null {
  const resourceId = project ? projectSeCue(project, "textBlip") : undefined;
  if (!project || !resourceId) return null;
  let count = 0;
  let lastAt = -Infinity;
  return {
    speak(char: string): void {
      if (!isVoicedChar(char)) return;
      count += 1;
      if (count % 2 === 0) return;
      const at = now();
      if (at - lastAt < TEXT_BLIP_MIN_GAP_MS) return;
      lastAt = at;
      playAudioCommand({ resourceId, loop: false, channel: "se", volume: TEXT_BLIP_VOLUME }, project);
    },
  };
}
