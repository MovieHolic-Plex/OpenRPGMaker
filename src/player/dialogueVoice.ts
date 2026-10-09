// player/dialogueVoice.ts — 글자마다 나는 대화 목소리(합성 신호음).
//
// 녹음 없이 짧은 오실레이터 한 번이 한 음절이다. 한국어는 음절 블록 하나가 말 박자 하나라
// 공백·문장부호는 건너뛰고 한글 음절·영숫자에서만 울린다. 최소 간격(minGapMs)을 지켜
// 빠른 글자에서 윙윙거리지 않게 하고, 음 높이를 조금씩 흔들어 기관총 소리를 피한다.
// initial 모드는 초성(ㄱ~ㅎ 19개)으로 음을 골라 재잘거리는 느낌을 낸다.
//
// 컨텍스트는 전투 효과음과 같은 것을 쓴다(battleAudioContext) — 둘이면 언락 시점이 갈라져 한쪽만 무음이 된다.

import { battleAudioContext } from "@/player/battleSfx";
import { getPlayerPreferences } from "@/player/playerPreferences";
import type { DialogueLook } from "@/project/dialogueStyles";

const HANGUL_START = 0xac00;
const HANGUL_COUNT = 11172;
const MASTER_GAIN = 0.22;

export interface DialogueVoicePlayer {
  /** 글자 하나가 화면에 나타날 때 부른다. */
  speak(char: string): void;
}

const SILENT: DialogueVoicePlayer = { speak() {} };

export function isVoicedChar(char: string): boolean {
  return /[가-힣ㄱ-ㆎA-Za-z0-9ぁ-んァ-ン一-龥]/u.test(char);
}

/** 초성 번호(0~18). 한글 음절이 아니면 -1. */
export function hangulInitialIndex(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  const offset = code - HANGUL_START;
  return offset >= 0 && offset < HANGUL_COUNT ? Math.floor(offset / 588) : -1;
}

/**
 * 한 줄 대사용 목소리. look.voice 가 없거나 오디오를 못 쓰는 환경이면 조용한 플레이어를 돌려준다.
 * random 은 테스트 주입 구멍.
 */
export function createDialogueVoice(
  look: Pick<DialogueLook, "voice" | "voicePitch" | "voiceGain">,
  options: { readonly random?: () => number; readonly context?: () => AudioContext | undefined } = {},
): DialogueVoicePlayer {
  const voice = look.voice;
  if (!voice) return SILENT;
  const random = options.random ?? Math.random;
  const getContext = options.context ?? battleAudioContext;
  const pitchRatio = Math.pow(2, look.voicePitch / 12);
  let lastAt = -Infinity;
  let count = 0;
  return {
    speak(char: string): void {
      if (!isVoicedChar(char)) return;
      count += 1;
      if (voice.mode === "alternate" && count % 2 === 0) return;
      const ctx = getContext();
      if (!ctx) return;
      // 대사 목소리 음량은 설정 메뉴의 「대사 목소리」 칸이 따로 정한다.
      const volume = getPlayerPreferences().voice;
      if (volume <= 0) return;
      const now = ctx.currentTime;
      if ((now - lastAt) * 1000 < voice.minGapMs) return;
      lastAt = now;
      let frequency = voice.frequency * pitchRatio;
      if (voice.mode === "initial") {
        const initial = hangulInitialIndex(char);
        if (initial >= 0) frequency *= Math.pow(2, ((initial - 9) / 19) * 1.1);
      }
      frequency *= 1 + (random() * 2 - 1) * voice.variance;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = voice.wave;
      oscillator.frequency.value = frequency;
      const peak = Math.max(0.0002, voice.gain * look.voiceGain * volume * MASTER_GAIN);
      gain.gain.setValueAtTime(peak, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + voice.duration);
      oscillator.connect(gain);
      let tail: AudioNode = gain;
      if (voice.bandpass) {
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1400;
        filter.Q.value = 3;
        gain.connect(filter);
        tail = filter;
      }
      tail.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + voice.duration + 0.02);
    },
  };
}
