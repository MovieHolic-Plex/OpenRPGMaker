import { describe, expect, it } from "vitest";

import {
  DIALOGUE_EMOTIONS,
  dialoguePresentationCssVars,
  dialoguePresentationProfile,
  dialogueScaledCharDelayMs,
  dialogueSpeakerInsetPx,
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

describe("dialogueSpeakerInsetPx", () => {
  it("이름표가 파고든 깊이를 여백으로 돌려준다", () => {
    // 실측 2026-08-30: 높이 19px, top -9px → 아래 변이 10px 지점.
    // 그때 CSS 기본값은 8px 이어서 본문 첫 줄이 2px 덮여 있었다.
    expect(dialogueSpeakerInsetPx(-9, 19, 8)).toBe(10);
  });

  it("기존 여백보다 좁히지 않는다", () => {
    // 이름표가 창 위로 완전히 빠져 있어도(겹침 0) 원래 숨 쉬던 자리는 남긴다 —
    // 좁히면 줄 수가 이유 없이 늘었다 줄었다 한다.
    expect(dialogueSpeakerInsetPx(-24, 19, 8)).toBe(8);
    expect(dialogueSpeakerInsetPx(-19, 19, 8)).toBe(8);
  });

  it("소수 높이는 위로 올린다", () => {
    // 내림하면 1px 이 남아 다시 덮인다.
    expect(dialogueSpeakerInsetPx(-9, 19.4, 8)).toBe(11);
  });

  it("글꼴이 커지면 따라 내려간다", () => {
    expect(dialogueSpeakerInsetPx(-9, 34, 8)).toBe(25);
  });

  it("레이아웃이 없으면 CSS 기본값을 쓰라고 undefined 를 준다", () => {
    // jsdom 은 offsetHeight 가 0 이다. 여기서 0 을 심으면 이름표가 본문을 통째로 덮는다.
    expect(dialogueSpeakerInsetPx(-9, 0, 8)).toBeUndefined();
    expect(dialogueSpeakerInsetPx(Number.NaN, 19, 8)).toBeUndefined();
  });
});
