/** Common presentation for text, still pictures and video. Omission keeps legacy playback. */
export const CINEMATIC_PRESENTATION_PRESETS = ['subtitle', 'prologue', 'chapter', 'memory', 'credits'] as const;
export const CINEMATIC_TEXT_ANIMATIONS = ['none', 'fade', 'rise', 'typewriter', 'blur', 'scroll'] as const;
export const CINEMATIC_ENTRANCES = ['cut', 'fade', 'dissolve', 'wipe', 'iris', 'flash', 'dither'] as const;
export type CinematicPresentation = {
  preset?: typeof CINEMATIC_PRESENTATION_PRESETS[number];
  backgroundColor?: string;
  /** Percentage of stage height at each edge. */
  letterbox?: number;
  text?: {
    layout?: 'center' | 'bottom' | 'bar' | 'left' | 'credits';
    font?: 'serif' | 'sans' | 'pixel';
    size?: number;
    color?: string;
    animation?: typeof CINEMATIC_TEXT_ANIMATIONS[number];
    delayMs?: number;
    revealMs?: number;
    exitMs?: number;
  };
  transition?: {
    enter?: typeof CINEMATIC_ENTRANCES[number];
    enterMs?: number;
    exitMs?: number;
  };
};

export const CINEMATIC_PRESENTATION_DEFAULTS = {
  subtitle: { text: { layout: 'bottom', font: 'sans', size: 13, color: '#fff8ea', animation: 'typewriter', delayMs: 350, revealMs: 700, exitMs: 350 }, transition: { enter: 'dissolve', enterMs: 650, exitMs: 0 }, letterbox: 6 },
  prologue: { text: { layout: 'center', font: 'serif', size: 13, color: '#f5e7cd', animation: 'typewriter', delayMs: 300, revealMs: 1600, exitMs: 600 }, transition: { enter: 'fade', enterMs: 800, exitMs: 600 }, letterbox: 0 },
  chapter: { text: { layout: 'center', font: 'serif', size: 16, color: '#f4d69c', animation: 'rise', delayMs: 250, revealMs: 900, exitMs: 500 }, transition: { enter: 'iris', enterMs: 800, exitMs: 550 }, letterbox: 0 },
  memory: { text: { layout: 'left', font: 'serif', size: 13, color: '#eee7ff', animation: 'blur', delayMs: 450, revealMs: 1100, exitMs: 600 }, transition: { enter: 'fade', enterMs: 900, exitMs: 650 }, letterbox: 7 },
  credits: { text: { layout: 'credits', font: 'sans', size: 11, color: '#fff8ea', animation: 'scroll', delayMs: 0, revealMs: 0, exitMs: 500 }, transition: { enter: 'fade', enterMs: 700, exitMs: 600 }, letterbox: 0 },
} as const;

/**
 * 글자 크기(무대 논리 픽셀). 폼·저장·조수 도구·재생이 같은 8–64 다.
 * 재생기가 13–16으로 접으면 제목 카드에 40을 넣어도 자막과 같은 16으로 그려지고,
 * 크레딧 기본 11은 13으로 커진다. 320×240 무대가 3배로 보이므로 40은 화면에서 큰 제목이고,
 * 64는 한 줄 제목의 상한이다. 넘치는 줄은 프레임이 자른다.
 */
export const CINEMATIC_TEXT_SIZE_MIN = 8;
export const CINEMATIC_TEXT_SIZE_MAX = 64;

/** 숫자가 아니면 자막 기본(13). 그 밖은 폼과 같은 8–64 경계로 접는다. */
export function clampCinematicTextSize(size: number): number {
  const value = Number.isFinite(size) ? Math.round(size) : CINEMATIC_PRESENTATION_DEFAULTS.subtitle.text.size;
  return Math.min(CINEMATIC_TEXT_SIZE_MAX, Math.max(CINEMATIC_TEXT_SIZE_MIN, value));
}
export function resolveCinematicPresentation(value: CinematicPresentation) {
  const defaults = CINEMATIC_PRESENTATION_DEFAULTS[value.preset ?? 'subtitle'];
  return {
    backgroundColor: value.backgroundColor ?? '#000000',
    letterbox: value.letterbox ?? defaults.letterbox,
    text: { ...defaults.text, ...value.text },
    transition: { ...defaults.transition, ...value.transition },
  };
}

/** One strict parser used by project loading and AI authoring. No CSS/HTML strings accepted. */
export function parseCinematicPresentation(value: unknown): CinematicPresentation {
  const record = (raw: unknown, path: string, keys: string[]): Record<string, unknown> => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError(`${path} must be an object`);
    for (const key of Object.keys(raw)) if (!keys.includes(key)) throw new TypeError(`${path}.${key} is unsupported`);
    return raw as Record<string, unknown>;
  };
  const choice = (raw: unknown, path: string, values: readonly string[]): void => {
    if (typeof raw !== 'string' || !values.includes(raw)) throw new TypeError(`${path} must be ${values.join('/')}`);
  };
  const number = (raw: unknown, path: string, min: number, max: number): void => {
    if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < min || raw > max) throw new TypeError(`${path} must be an integer in ${min}..${max}`);
  };
  const color = (raw: unknown, path: string): void => {
    if (typeof raw !== 'string' || !/^#[0-9a-f]{6}$/iu.test(raw)) throw new TypeError(`${path} must be #RRGGBB`);
  };
  const p = record(value, 'presentation', ['preset', 'backgroundColor', 'letterbox', 'text', 'transition']);
  if (p.preset !== undefined) choice(p.preset, 'presentation.preset', CINEMATIC_PRESENTATION_PRESETS);
  if (p.backgroundColor !== undefined) color(p.backgroundColor, 'presentation.backgroundColor');
  if (p.letterbox !== undefined) number(p.letterbox, 'presentation.letterbox', 0, 20);
  if (p.text !== undefined) {
    const t = record(p.text, 'presentation.text', ['layout', 'font', 'size', 'color', 'animation', 'delayMs', 'revealMs', 'exitMs']);
    if (t.layout !== undefined) choice(t.layout, 'presentation.text.layout', ['center', 'bottom', 'bar', 'left', 'credits']);
    if (t.font !== undefined) choice(t.font, 'presentation.text.font', ['serif', 'sans', 'pixel']);
    if (t.animation !== undefined) choice(t.animation, 'presentation.text.animation', CINEMATIC_TEXT_ANIMATIONS);
    if (t.size !== undefined) number(t.size, 'presentation.text.size', CINEMATIC_TEXT_SIZE_MIN, CINEMATIC_TEXT_SIZE_MAX);
    if (t.color !== undefined) color(t.color, 'presentation.text.color');
    for (const key of ['delayMs', 'revealMs', 'exitMs']) if (t[key] !== undefined) number(t[key], `presentation.text.${key}`, 0, 10000);
  }
  if (p.transition !== undefined) {
    const t = record(p.transition, 'presentation.transition', ['enter', 'enterMs', 'exitMs']);
    if (t.enter !== undefined) choice(t.enter, 'presentation.transition.enter', CINEMATIC_ENTRANCES);
    for (const key of ['enterMs', 'exitMs']) if (t[key] !== undefined) number(t[key], `presentation.transition.${key}`, 0, 5000);
  }
  return structuredClone(p) as CinematicPresentation;
}

/** An intentional typography opening can satisfy first creation without fabricated pictures. */
export function hasAuthoredTextOpening(scenes: readonly { kind: string; narration: string; presentation?: CinematicPresentation }[]): boolean {
  return scenes.length >= 2 && scenes.every(scene => scene.kind === 'text' && scene.narration.trim().length > 0 && scene.presentation?.preset)
    && new Set(scenes.map(scene => { const p = resolveCinematicPresentation(scene.presentation!); return `${p.text.layout}:${p.text.animation}`; })).size >= 2
    && scenes.some(scene => resolveCinematicPresentation(scene.presentation!).text.animation !== 'none');
}
