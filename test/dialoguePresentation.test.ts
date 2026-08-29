import { describe, expect, it } from "vitest";

import {
  DIALOGUE_EMOTIONS,
  dialoguePresentationCssVars,
  dialoguePresentationProfile,
  dialogueScaledCharDelayMs,
  normalizeDialogueEmotion,
} from "@/player/dialoguePresentation";

describe("normalizeDialogueEmotion", () => {
  it("빈 값과 모르는 값을 neutral 로 떨어뜨린다", () => {
    expect(normalizeDialogueEmotion(undefined)).toBe("neutral");
    expect(normalizeDialogueEmotion("")).toBe("neutral");
    expect(normalizeDialogueEmotion("   ")).toBe("neutral");
    // 저장된 프로젝트나 AI 가 만든 값이 표에 없는 문자열일 수 있다.
    expect(normalizeDialogueEmotion("furious")).toBe("neutral");
  });

  it("앞뒤 공백은 털고 표에 있는 값은 그대로 쓴다", () => {
    expect(normalizeDialogueEmotion("  happy ")).toBe("happy");
    for (const emotion of DIALOGUE_EMOTIONS) {
      expect(normalizeDialogueEmotion(emotion)).toBe(emotion);
    }
  });
});

describe("dialoguePresentationProfile", () => {
  it("감정 5종 전부에 프로파일이 있다", () => {
    for (const emotion of DIALOGUE_EMOTIONS) {
      const profile = dialoguePresentationProfile(emotion);
      expect(profile.emotion).toBe(emotion);
      expect(profile.motion).toBe(true);
      expect(profile.enterMs).toBeGreaterThan(0);
      expect(profile.exitMs).toBeGreaterThan(0);
    }
  });

  it("감정마다 읽히는 성격이 다르다", () => {
    // 슬픔은 느리게 읽히고 분노·놀람은 빠르게 읽힌다.
    expect(dialoguePresentationProfile("sad").charDelayScale).toBeGreaterThan(1);
    expect(dialoguePresentationProfile("angry").charDelayScale).toBeLessThan(1);
    expect(dialoguePresentationProfile("surprised").charDelayScale).toBeLessThan(1);
    expect(dialoguePresentationProfile("neutral").charDelayScale).toBe(1);

    // 흔들림은 분노만, 플래시는 놀람만.
    expect(dialoguePresentationProfile("angry").shake).toBe(true);
    expect(dialoguePresentationProfile("surprised").flash).toBe(true);
    for (const emotion of ["neutral", "happy", "sad"] as const) {
      expect(dialoguePresentationProfile(emotion).shake).toBe(false);
      expect(dialoguePresentationProfile(emotion).flash).toBe(false);
    }
  });

  it("reducedMotion 은 움직임만 끄고 의미 신호는 남긴다", () => {
    for (const emotion of DIALOGUE_EMOTIONS) {
      const full = dialoguePresentationProfile(emotion);
      const reduced = dialoguePresentationProfile(emotion, { reducedMotion: true });

      expect(reduced.motion).toBe(false);
      expect(reduced.shake).toBe(false);
      expect(reduced.flash).toBe(false);
      expect(reduced.charReveal).toBe(false);
      expect(reduced.nameplateDelayMs).toBe(0);

      // 스크림과 읽는 속도는 움직임이 아니라 분위기·가독성 신호라 유지한다.
      expect(reduced.scrimOpacity).toBe(full.scrimOpacity);
      expect(reduced.charDelayScale).toBe(full.charDelayScale);

      // 0 으로 만들면 창이 툭 나타나 오히려 거칠다 — 짧은 페이드는 남긴다.
      expect(reduced.enterMs).toBeGreaterThan(0);
      expect(reduced.enterMs).toBeLessThan(full.enterMs);
    }
  });
});

describe("dialoguePresentationCssVars", () => {
  it("프로파일의 모든 지속시간이 CSS 변수로 빠짐없이 나간다", () => {
    // battleTransition 은 지속시간을 TS 와 CSS 양쪽에 손으로 적어 두었다가
    // close 가 260 vs 190 으로 어긋났다. 이 검사가 같은 드리프트를 막는다.
    for (const emotion of DIALOGUE_EMOTIONS) {
      for (const reducedMotion of [false, true]) {
        const profile = dialoguePresentationProfile(emotion, { reducedMotion });
        const vars = dialoguePresentationCssVars(profile);
        const emitted = Object.values(vars);
        for (const ms of [
          profile.enterMs,
          profile.exitMs,
          profile.nameplateDelayMs,
          profile.portraitMs,
          profile.scrimMs,
        ]) {
          expect(emitted).toContain(`${ms}ms`);
        }
        expect(vars["--dialogue-scrim-opacity"]).toBe(String(profile.scrimOpacity));
      }
    }
  });

  it("변수 이름은 모두 --dialogue- 로 시작한다", () => {
    const vars = dialoguePresentationCssVars(dialoguePresentationProfile("neutral"));
    for (const name of Object.keys(vars)) expect(name.startsWith("--dialogue-")).toBe(true);
  });
});

describe("dialogueScaledCharDelayMs", () => {
  it("기본 지연에 프로파일 배율을 적용한다", () => {
    expect(dialogueScaledCharDelayMs(24, dialoguePresentationProfile("neutral"))).toBe(24);
    expect(dialogueScaledCharDelayMs(24, dialoguePresentationProfile("sad"))).toBe(32);
    expect(dialogueScaledCharDelayMs(24, dialoguePresentationProfile("angry"))).toBe(19);
  });

  it("즉시 표시(0)는 0 으로 남기고 그 밖에는 1ms 를 남긴다", () => {
    // \> 즉시 표시는 지연 0 으로 들어온다 — 배율이 이걸 되살리면 안 된다.
    expect(dialogueScaledCharDelayMs(0, dialoguePresentationProfile("sad"))).toBe(0);
    expect(dialogueScaledCharDelayMs(1, dialoguePresentationProfile("angry"))).toBe(1);
  });
});
