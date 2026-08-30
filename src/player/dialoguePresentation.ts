// player/dialoguePresentation.ts
// 대화창 연출 프로파일. 「문장 표시」 커맨드의 emotion 값이 연출 선택자다.
//
// 순수 모델만 둔다 — DOM·window·matchMedia 를 만지지 않는다. 그래서 프로파일 표는
// 단위 테스트로 그대로 잠글 수 있고, reduced-motion 은 호출부가 주입한다
// (characterLanding.ts 의 `{ reducedMotion }` 관례와 같은 형태).
//
// 지속시간을 CSS 에도 적어 두지 않는다. battleTransition.ts 는 상수를 TS 와
// runtime/transitions.css 양쪽에 손으로 적어 두었다가 close 가 260 vs 190 으로
// 어긋났다. 여기서는 TS 가 진실 공급원이고 CSS 는 var() 로 받아 쓴다.

export const DIALOGUE_EMOTIONS = ["neutral", "happy", "sad", "angry", "surprised"] as const;

export type DialogueEmotion = (typeof DIALOGUE_EMOTIONS)[number];

export type DialoguePresentationProfile = {
  readonly emotion: DialogueEmotion;
  /** 창 진입 길이(ms). */
  readonly enterMs: number;
  /** 창 퇴장 길이(ms). 이 값만큼 지연한 뒤 상자를 DOM 에서 뺀다. */
  readonly exitMs: number;
  /** 이름표가 창보다 늦게 들어오는 지연(ms). */
  readonly nameplateDelayMs: number;
  /** 초상화 진입 길이(ms). */
  readonly portraitMs: number;
  /** 스크림(배경 디밍) 목표 불투명도 0~1. */
  readonly scrimOpacity: number;
  /** 스크림 페이드 길이(ms). */
  readonly scrimMs: number;
  /** 글자 지연 배율. 1 보다 크면 느리게 읽힌다. */
  readonly charDelayScale: number;
  /** 창을 1회 흔든다. */
  readonly shake: boolean;
  /** 스크림을 순간 밝힌다. */
  readonly flash: boolean;
  /** 글자별 등장 연출을 켠다. */
  readonly charReveal: boolean;
  /** false 면 움직임을 뺀 상태다(의미를 나르는 신호는 남는다). */
  readonly motion: boolean;
};

export type DialoguePresentationOptions = {
  /** 호출부가 prefersReducedMotion() 결과를 넣는다. */
  readonly reducedMotion?: boolean;
};

type ProfileTableEntry = Omit<DialoguePresentationProfile, "emotion" | "motion">;

// 톤: 모던 UI 계열의 절제된 탄력. 오버슈트는 세로가 주고 가로는 거의 안 준다 —
// 가로로 4% 를 부풀리면 1280 뷰포트에서 상자 좌우 여백이 16px 하한을 깨고
// test/e2e/dialogue-modern-skin.spec.ts 의 leftGutter/rightGutter 단정이 깨진다
// (getBoundingClientRect 는 transform 을 포함하고, 그 측정은 타이핑 중에 일어난다).
// 실제 커브와 배율은 src/styles/dialogue.css 의 dialogue-box-* keyframes 가 갖는다.
const DIALOGUE_PRESENTATION_TABLE = {
  neutral: {
    enterMs: 170,
    exitMs: 120,
    nameplateDelayMs: 40,
    portraitMs: 200,
    scrimOpacity: 0.28,
    scrimMs: 180,
    charDelayScale: 1,
    shake: false,
    flash: false,
    charReveal: true,
  },
  happy: {
    enterMs: 180,
    exitMs: 120,
    nameplateDelayMs: 40,
    portraitMs: 200,
    scrimOpacity: 0.22,
    scrimMs: 180,
    charDelayScale: 0.95,
    shake: false,
    flash: false,
    charReveal: true,
  },
  sad: {
    // 오버슈트를 뺀 느린 진입. 글자도 느리게 읽힌다.
    enterMs: 260,
    exitMs: 170,
    nameplateDelayMs: 70,
    portraitMs: 280,
    scrimOpacity: 0.34,
    scrimMs: 260,
    charDelayScale: 1.35,
    shake: false,
    flash: false,
    charReveal: true,
  },
  angry: {
    enterMs: 140,
    exitMs: 110,
    nameplateDelayMs: 0,
    portraitMs: 160,
    scrimOpacity: 0.42,
    scrimMs: 140,
    charDelayScale: 0.8,
    shake: true,
    flash: false,
    charReveal: true,
  },
  surprised: {
    enterMs: 160,
    exitMs: 110,
    nameplateDelayMs: 0,
    portraitMs: 170,
    scrimOpacity: 0.2,
    scrimMs: 140,
    charDelayScale: 0.8,
    shake: false,
    flash: true,
    charReveal: true,
  },
} as const satisfies Record<DialogueEmotion, ProfileTableEntry>;

/** 움직임을 뺀 상태의 길이. 0 으로 두면 창이 툭 나타나 오히려 거칠게 읽힌다. */
const REDUCED_MOTION_MS = 60;

export function normalizeDialogueEmotion(value: string | undefined): DialogueEmotion {
  const trimmed = value?.trim();
  if (!trimmed) return "neutral";
  return (DIALOGUE_EMOTIONS as readonly string[]).includes(trimmed)
    ? (trimmed as DialogueEmotion)
    : "neutral";
}

export function dialoguePresentationProfile(
  emotion: string | undefined,
  options: DialoguePresentationOptions = {}
): DialoguePresentationProfile {
  const resolved = normalizeDialogueEmotion(emotion);
  const entry = DIALOGUE_PRESENTATION_TABLE[resolved];
  if (options.reducedMotion !== true) {
    return { emotion: resolved, motion: true, ...entry };
  }
  // 움직임만 끄고 의미를 나르는 신호는 남긴다 (src/styles/runtime/juice.css 의 원칙).
  // 스크림과 글자 지연 배율은 움직임이 아니라 분위기·가독성 신호라 유지한다.
  return {
    emotion: resolved,
    motion: false,
    enterMs: REDUCED_MOTION_MS,
    exitMs: REDUCED_MOTION_MS,
    nameplateDelayMs: 0,
    portraitMs: REDUCED_MOTION_MS,
    scrimOpacity: entry.scrimOpacity,
    scrimMs: entry.scrimMs,
    charDelayScale: entry.charDelayScale,
    shake: false,
    flash: false,
    charReveal: false,
  };
}

/**
 * CSS 가 읽을 변수. 지속시간을 CSS 에 중복 기재하지 않기 위한 유일한 통로다.
 * 값은 단위까지 붙여 돌려준다 — 호출부가 style.setProperty 로 그대로 심는다.
 */
export function dialoguePresentationCssVars(
  profile: DialoguePresentationProfile
): Readonly<Record<string, string>> {
  return {
    "--dialogue-enter-ms": `${profile.enterMs}ms`,
    "--dialogue-exit-ms": `${profile.exitMs}ms`,
    "--dialogue-nameplate-delay-ms": `${profile.nameplateDelayMs}ms`,
    "--dialogue-portrait-ms": `${profile.portraitMs}ms`,
    "--dialogue-scrim-ms": `${profile.scrimMs}ms`,
    "--dialogue-scrim-opacity": String(profile.scrimOpacity),
  };
}

/**
 * 이름표 아래에서 본문이 비켜 줄 자리(논리 px). `.dialogue-box.has-speaker` 의
 * `padding-top` 으로 심는다.
 *
 * 이름표는 `position: absolute; top: -9px` 로 창 위 변에 걸친 탭이고, 본문이 비켜 주는
 * 자리는 그 padding 뿐이다. 두 값을 각각 손으로 적어 두면 서로 모른다 — 실측 2026-08-30 에
 * 이름표 높이 19px, top -9px 라 아래 변이 10px 지점인데 padding 은 8px 이어서
 * **본문 첫 줄이 2px 덮였다**(글자 윗부분이 잘려 보인다). 두 선언은 각각 유효하므로
 * 계산된 스타일로는 안 잡히고, 겹침이 기하라서 jsdom 단위 테스트로도 안 잡힌다.
 * `src/styles/TOKENS.md` 가 "본문과 겹치지 않도록 함께 조정한다"고 적어 둔 짝이 이것이다.
 *
 * 그래서 상수를 고치지 않고 **이름표를 재서** 정한다. 글꼴 크기가 바뀌어도 따라온다.
 * 호출부가 `offsetTop`(음수) 과 `offsetHeight` 를 넣는다. 레이아웃이 없는 환경은 높이가
 * 0 이므로 그때는 CSS 기본값을 그대로 쓰라고 `undefined` 를 돌려준다.
 */
export function dialogueSpeakerInsetPx(
  plateOffsetTop: number,
  plateOffsetHeight: number,
  fallbackInsetPx: number
): number | undefined {
  if (!Number.isFinite(plateOffsetHeight) || plateOffsetHeight <= 0) return undefined;
  if (!Number.isFinite(plateOffsetTop)) return undefined;
  // 아래 변이 상자 안쪽으로 들어온 깊이. 이름표가 창 위로 완전히 빠져 있으면 0 이하가 된다.
  const intrusion = plateOffsetTop + plateOffsetHeight;
  // 원래 있던 여백보다 좁히지는 않는다 — 겹침만 없애면 되고, 줄 수는 남는 높이에서
  // dialogueMaxLines 가 다시 센다(좁히면 이유 없이 한 줄을 잃을 수 있다).
  return Math.max(fallbackInsetPx, Math.ceil(intrusion));
}

/** 글자 지연에 프로파일 배율을 적용한다. 최소 1ms 는 남겨 타이핑 루프가 멈추지 않게 한다. */
export function dialogueScaledCharDelayMs(baseDelayMs: number, profile: DialoguePresentationProfile): number {
  if (!Number.isFinite(baseDelayMs) || baseDelayMs <= 0) return 0;
  return Math.max(1, Math.round(baseDelayMs * profile.charDelayScale));
}
