/**
 * 타이틀 화면 영역 효과(빛내림·먼지·칼날 반사·물결·안개·잎 그림자·불빛·카메라 호흡)의 순수 모델.
 *
 * - 좌표는 전부 배경 그림 기준 정규 좌표(0..1)다. 빛 근원처럼 그림 밖에 있는 점은 -0.5..1.5 까지 허용한다.
 * - normalize 는 omit-when-default 다. 레거시 JSON 은 필드가 생기지 않고, 기본값과 같은 값은 저장하지 않는다.
 * - 런타임 렌더러(`src/player/titleEffects/`)와 편집기·AI 도구가 같은 함수를 쓴다.
 */
import type {
  TitleBackgroundFit,
  TitleBackgroundRendering,
  TitleEffect,
  TitleEffectKind,
  TitleEffectPoint,
  TitleLogoShine,
  TitleLogoStyle,
  TitleMenuStyle,
  TitleOpeningSequence,
  TitleScreenSettings,
  TitleSequenceLogoReveal,
  TitleTransitionKind,
  TitleTransitionSettings,
} from "@/project/types";

export const MAX_TITLE_EFFECTS = 12;
export const MAX_TITLE_EFFECT_REGION_POINTS = 8;
export const MAX_TITLE_MOTES = 96;
export const MAX_TITLE_LOGO_SUBTITLE_LENGTH = 60;

export const TITLE_EFFECT_KINDS: readonly TitleEffectKind[] = [
  "godRays",
  "motes",
  "glint",
  "water",
  "mist",
  "dapple",
  "glow",
  "camera",
];
export const TITLE_BACKGROUND_FITS: readonly TitleBackgroundFit[] = ["cover", "contain", "stretch"];
export const TITLE_BACKGROUND_RENDERINGS: readonly TitleBackgroundRendering[] = ["smooth", "pixelated"];
export const TITLE_LOGO_STYLES: readonly TitleLogoStyle[] = ["plain", "metal", "gold", "stone", "glow"];
export const TITLE_MENU_STYLES: readonly TitleMenuStyle[] = ["window", "plain"];

/** 편집기·도구 설명에 쓰는 한국어 이름. */
export const TITLE_EFFECT_LABELS: Readonly<Record<TitleEffectKind, string>> = {
  godRays: "빛내림",
  motes: "빛 먼지",
  glint: "칼날 반사광",
  water: "물결",
  mist: "안개",
  dapple: "잎 그림자",
  glow: "불빛",
  camera: "카메라 호흡",
};

/** 종류별로 어떤 기하가 필요한가 — 편집기 손잡이와 AI 조립이 이 표를 따른다. */
export const TITLE_EFFECT_GEOMETRY: Readonly<Record<TitleEffectKind, "ray" | "line" | "region" | "point" | "none">> = {
  godRays: "ray",
  motes: "ray",
  glint: "line",
  water: "region",
  mist: "region",
  dapple: "region",
  glow: "point",
  camera: "none",
};

/** 종류별 기본색. 렌더러는 color 가 없으면 이 값을 쓴다. */
export const TITLE_EFFECT_DEFAULT_COLORS: Readonly<Record<TitleEffectKind, string>> = {
  godRays: "#ffdb8c",
  motes: "#ffeeb3",
  glint: "#ffffff",
  water: "#e8f4ff",
  mist: "#dbe3ed",
  dapple: "#000000",
  glow: "#ffb454",
  camera: "#000000",
};

export function isTitleEffectKind(value: unknown): value is TitleEffectKind {
  return typeof value === "string" && (TITLE_EFFECT_KINDS as readonly string[]).includes(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 소수 4자리 — 드래그로 생기는 긴 부동소수가 JSON 을 부풀리지 않게. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function normalizePoint(value: unknown): TitleEffectPoint | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [x, y] = value;
  if (!finite(x) || !finite(y)) return undefined;
  return [round4(clamp(x, -0.5, 1.5)), round4(clamp(y, -0.5, 1.5))];
}

function normalizeRegion(value: unknown): TitleEffectPoint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const points: TitleEffectPoint[] = [];
  for (const raw of value) {
    if (points.length >= MAX_TITLE_EFFECT_REGION_POINTS) break;
    const point = normalizePoint(raw);
    if (point) points.push(point);
  }
  return points.length >= 3 ? points : undefined;
}

function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/u.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/u.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return undefined;
}

/** 기본값과 같거나 무효면 생략. */
function optionalScalar(value: unknown, min: number, max: number, fallback: number): number | undefined {
  if (!finite(value)) return undefined;
  const next = round4(clamp(value, min, max));
  return next === fallback ? undefined : next;
}

/**
 * 효과 하나를 정규화한다. 종류에 필요한 기하가 없으면 그릴 수 없으므로 undefined(버림).
 * 종류와 무관한 필드는 버린다 — 저장본에 쓰이지 않는 값이 남지 않게.
 */
export function normalizeTitleEffect(raw: unknown): TitleEffect | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const effect = raw as Partial<Record<keyof TitleEffect, unknown>>;
  if (!isTitleEffectKind(effect.kind)) return undefined;
  const kind = effect.kind;
  const geometry = TITLE_EFFECT_GEOMETRY[kind];
  const intensity = optionalScalar(effect.intensity, 0, 2, 1);
  const speed = optionalScalar(effect.speed, 0, 4, 1);
  const color = kind === "camera" || kind === "dapple" ? undefined : normalizeColor(effect.color);
  const result: TitleEffect = {
    kind,
    ...(effect.enabled === false ? { enabled: false } : {}),
    ...(intensity !== undefined ? { intensity } : {}),
    ...(speed !== undefined ? { speed } : {}),
    ...(color && color !== TITLE_EFFECT_DEFAULT_COLORS[kind] ? { color } : {}),
  };
  if (geometry === "ray") {
    const source = normalizePoint(effect.source);
    const toward = normalizePoint(effect.toward);
    const region = kind === "motes" ? normalizeRegion(effect.region) : undefined;
    // motes 는 부채꼴(source/toward) 또는 region 중 하나만 있으면 된다.
    if (!(source && toward) && !region) return undefined;
    if (source && toward) {
      result.source = source;
      result.toward = toward;
    }
    if (region) result.region = region;
    const spread = optionalScalar(effect.spread, 0.02, 1, kind === "godRays" ? 0.19 : 0.28);
    if (spread !== undefined) result.spread = spread;
    if (kind === "motes" && finite(effect.count)) {
      const count = Math.round(clamp(effect.count, 0, MAX_TITLE_MOTES));
      if (count !== 60) result.count = count;
    }
  } else if (geometry === "line") {
    const line = Array.isArray(effect.line) ? effect.line : undefined;
    const a = normalizePoint(line?.[0]);
    const b = normalizePoint(line?.[1]);
    if (!a || !b) return undefined;
    result.line = [a, b];
    const periodSec = optionalScalar(effect.periodSec, 1, 60, 5);
    if (periodSec !== undefined) result.periodSec = periodSec;
  } else if (geometry === "region") {
    const region = normalizeRegion(effect.region);
    if (!region) return undefined;
    result.region = region;
  } else if (geometry === "point") {
    const source = normalizePoint(effect.source);
    if (!source) return undefined;
    result.source = source;
    const spread = optionalScalar(effect.spread, 0.02, 1, 0.08);
    if (spread !== undefined) result.spread = spread;
  }
  return result;
}

export function normalizeTitleEffects(value: unknown): TitleEffect[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const effects: TitleEffect[] = [];
  for (const raw of value) {
    if (effects.length >= MAX_TITLE_EFFECTS) break;
    const effect = normalizeTitleEffect(raw);
    if (effect) effects.push(effect);
  }
  return effects.length > 0 ? effects : undefined;
}

export function normalizeTitleBackgroundFit(value: unknown): TitleBackgroundFit | undefined {
  return typeof value === "string" && (TITLE_BACKGROUND_FITS as readonly string[]).includes(value)
    ? (value as TitleBackgroundFit)
    : undefined;
}

export function normalizeTitleBackgroundRendering(value: unknown): TitleBackgroundRendering | undefined {
  return typeof value === "string" && (TITLE_BACKGROUND_RENDERINGS as readonly string[]).includes(value)
    ? (value as TitleBackgroundRendering)
    : undefined;
}

export function normalizeTitleLogoStyle(value: unknown): TitleLogoStyle | undefined {
  return typeof value === "string" && (TITLE_LOGO_STYLES as readonly string[]).includes(value)
    ? (value as TitleLogoStyle)
    : undefined;
}

export function normalizeTitleMenuStyle(value: unknown): TitleMenuStyle | undefined {
  // "window" 는 생략과 같다(레거시 기본) — 저장하지 않는다.
  return value === "plain" ? "plain" : undefined;
}

export function normalizeTitleLogoSubtitle(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_TITLE_LOGO_SUBTITLE_LENGTH);
  return trimmed || undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// 입장 시퀀스·반사광·새 게임 전환 — 첫 진입 연출과 게임으로 넘어가는 순간.
// ─────────────────────────────────────────────────────────────────────────────

export const TITLE_SEQUENCE_LOGO_REVEALS: readonly TitleSequenceLogoReveal[] = ["bloom", "rise", "fade", "wipe"];
export const TITLE_LOGO_SHINES: readonly TitleLogoShine[] = ["none", "once", "loop"];
export const TITLE_TRANSITION_KINDS: readonly TitleTransitionKind[] = ["flash", "fade", "zoom", "mist"];

export const DEFAULT_TITLE_SEQUENCE_FADE_MS = 1600;
export const DEFAULT_TITLE_SEQUENCE_PUSH = 0.08;
export const DEFAULT_TITLE_SEQUENCE_LOGO_AT_MS = 1100;
/** 로고 등장 후 메뉴가 뜨기까지. */
export const DEFAULT_TITLE_SEQUENCE_MENU_GAP_MS = 1100;
export const TITLE_TRANSITION_DEFAULT_MS: Readonly<Record<TitleTransitionKind, number>> = {
  flash: 700,
  fade: 800,
  zoom: 1000,
  mist: 1100,
};
/** 반사광 loop 한 바퀴. */
export const TITLE_LOGO_SHINE_PERIOD_MS = 6000;

function clampInt(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(Math.min(max, Math.max(min, value)));
}

/** 필드가 하나도 없어도 `{}` 를 돌려준다 — 「시퀀스 켬, 전부 기본값」을 뜻한다. 객체가 아니면 undefined(끔). */
export function normalizeTitleOpeningSequence(value: unknown): TitleOpeningSequence | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const fadeMs = clampInt(raw.fadeMs, 0, 6000);
  const pushRaw = typeof raw.push === "number" && Number.isFinite(raw.push) ? Math.min(0.3, Math.max(0, raw.push)) : undefined;
  const push = pushRaw === undefined ? undefined : Math.round(pushRaw * 1000) / 1000;
  const logoAtMs = clampInt(raw.logoAtMs, 0, 10000);
  const menuAtMs = clampInt(raw.menuAtMs, 0, 12000);
  const logoReveal = TITLE_SEQUENCE_LOGO_REVEALS.includes(raw.logoReveal as TitleSequenceLogoReveal)
    ? (raw.logoReveal as TitleSequenceLogoReveal)
    : undefined;
  return {
    ...(fadeMs !== undefined && fadeMs !== DEFAULT_TITLE_SEQUENCE_FADE_MS ? { fadeMs } : {}),
    ...(push !== undefined && push !== DEFAULT_TITLE_SEQUENCE_PUSH ? { push } : {}),
    ...(raw.sweep === false ? { sweep: false } : {}),
    ...(logoAtMs !== undefined && logoAtMs !== DEFAULT_TITLE_SEQUENCE_LOGO_AT_MS ? { logoAtMs } : {}),
    ...(logoReveal && logoReveal !== "bloom" ? { logoReveal } : {}),
    ...(menuAtMs !== undefined ? { menuAtMs } : {}),
  };
}

/** 런타임이 쓰는 확정 값. */
export interface ResolvedTitleOpeningSequence {
  fadeMs: number;
  push: number;
  sweep: boolean;
  logoAtMs: number;
  logoReveal: TitleSequenceLogoReveal;
  menuAtMs: number;
}

export function resolveTitleOpeningSequence(sequence: TitleOpeningSequence): ResolvedTitleOpeningSequence {
  const logoAtMs = sequence.logoAtMs ?? DEFAULT_TITLE_SEQUENCE_LOGO_AT_MS;
  return {
    fadeMs: sequence.fadeMs ?? DEFAULT_TITLE_SEQUENCE_FADE_MS,
    push: sequence.push ?? DEFAULT_TITLE_SEQUENCE_PUSH,
    sweep: sequence.sweep !== false,
    logoAtMs,
    logoReveal: sequence.logoReveal ?? "bloom",
    menuAtMs: sequence.menuAtMs ?? logoAtMs + DEFAULT_TITLE_SEQUENCE_MENU_GAP_MS,
  };
}

export function normalizeTitleLogoShine(value: unknown): TitleLogoShine | undefined {
  return value === "once" || value === "loop" ? value : undefined;
}

export function normalizeTitleTransition(value: unknown): TitleTransitionSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (!TITLE_TRANSITION_KINDS.includes(raw.kind as TitleTransitionKind)) return undefined;
  const kind = raw.kind as TitleTransitionKind;
  const durationMs = clampInt(raw.durationMs, 200, 3000);
  return {
    kind,
    ...(durationMs !== undefined && durationMs !== TITLE_TRANSITION_DEFAULT_MS[kind] ? { durationMs } : {}),
  };
}

export function titleTransitionDurationMs(transition: TitleTransitionSettings): number {
  return transition.durationMs ?? TITLE_TRANSITION_DEFAULT_MS[transition.kind];
}

/** normalizeTitleScreenSettings 가 펼쳐 넣는 오프닝 확장 필드 묶음(전부 omit-when-empty). */
export function normalizeTitleOpeningFields(
  settings: Partial<TitleScreenSettings> | undefined,
): Pick<
  TitleScreenSettings,
  | "backgroundFit"
  | "backgroundRendering"
  | "effects"
  | "logoStyle"
  | "logoSubtitle"
  | "menuStyle"
  | "sequence"
  | "logoShine"
  | "transition"
> {
  const backgroundFit = normalizeTitleBackgroundFit(settings?.backgroundFit);
  const backgroundRendering = normalizeTitleBackgroundRendering(settings?.backgroundRendering);
  const effects = normalizeTitleEffects(settings?.effects);
  const logoStyle = normalizeTitleLogoStyle(settings?.logoStyle);
  const logoSubtitle = normalizeTitleLogoSubtitle(settings?.logoSubtitle);
  const menuStyle = normalizeTitleMenuStyle(settings?.menuStyle);
  const sequence = normalizeTitleOpeningSequence(settings?.sequence);
  const logoShine = normalizeTitleLogoShine(settings?.logoShine);
  const transition = normalizeTitleTransition(settings?.transition);
  return {
    ...(backgroundFit ? { backgroundFit } : {}),
    ...(backgroundRendering ? { backgroundRendering } : {}),
    ...(effects ? { effects } : {}),
    ...(logoStyle ? { logoStyle } : {}),
    ...(logoSubtitle ? { logoSubtitle } : {}),
    ...(menuStyle ? { menuStyle } : {}),
    ...(sequence ? { sequence } : {}),
    ...(logoShine ? { logoShine } : {}),
    ...(transition ? { transition } : {}),
  };
}

/** 켜져 있는 효과만. */
export function activeTitleEffects(effects: readonly TitleEffect[] | undefined): TitleEffect[] {
  return (effects ?? []).filter((effect) => effect.enabled !== false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 기본 효과 — 편집기 「효과 추가」가 넣는 출발 기하. 그림 가운데쯤에 보이게 놓고 손잡이로 옮긴다.
// ─────────────────────────────────────────────────────────────────────────────

export function defaultTitleEffect(kind: TitleEffectKind): TitleEffect {
  switch (kind) {
    case "godRays":
      return { kind, source: [0.75, -0.05], toward: [0.55, 0.8] };
    case "motes":
      return { kind, source: [0.75, -0.05], toward: [0.55, 0.8] };
    case "glint":
      return { kind, line: [[0.6, 0.35], [0.7, 0.7]] };
    case "water":
      return { kind, region: [[0.2, 0.78], [0.8, 0.78], [0.85, 0.95], [0.15, 0.95]] };
    case "mist":
      return { kind, region: [[0.1, 0.5], [0.9, 0.48], [0.9, 0.7], [0.1, 0.72]] };
    case "dapple":
      return { kind, region: [[0, 0.7], [0.5, 0.65], [0.55, 1], [0, 1]] };
    case "glow":
      return { kind, source: [0.5, 0.5] };
    case "camera":
      return { kind };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 프리셋 — 분위기별 출발점. 장면·구도 문장(영문)은 AI 키아트 프롬프트로, 효과 좌표는 그 구도에 맞춘 초기값이다.
// 실제 그림에 맞추는 일은 AI 맞춤(titleArtFitting)과 편집기 무대의 끌기 손잡이가 한다.
// ─────────────────────────────────────────────────────────────────────────────

export interface TitleOpeningPreset {
  id: string;
  label: string;
  description: string;
  /** 편집기 칩에 찍는 대표색. 그라데이션 없이 점 하나로 분위기를 보인다. */
  accent: string;
  /** AI 키아트 프롬프트에 쓰는 장면 묘사(영문). */
  scene: string;
  /** 효과 좌표와 맞는 구도 지시(영문). 생성 그림이 프리셋 좌표에 가깝게 나오게 한다. */
  layout: string;
  logoStyle: TitleLogoStyle;
  menuStyle: TitleMenuStyle;
  effects: TitleEffect[];
  /** 입장 시퀀스·반사광·새 게임 전환 기본값. 분위기에 맞춘 속도와 전환 종류. */
  sequence: TitleOpeningSequence;
  logoShine: TitleLogoShine;
  transition: TitleTransitionSettings;
}

export const TITLE_OPENING_PRESETS: readonly TitleOpeningPreset[] = [
  {
    id: "forestMorning",
    label: "숲 아침 햇살",
    description: "나무 사이 빛내림과 먼지, 칼날 반사, 먼 강 물결, 산 안개.",
    accent: "#f2c46b",
    scene:
      "a sunlit fantasy forest clearing at morning, two swords leaning against a large tree on the right, a distant castle town on a river with a stone bridge, misty mountains far behind, strong sun rays through the canopy from the upper right",
    layout:
      "The sun sits just above the top edge at about 80% from the left, its rays falling down-left. The swords lean on the tree trunk at about 70-78% from the left, blades running from 34% to 83% of the height. The river and bridge sit at about 52-63% from the left and 54-61% of the height. Mountains and mist span the upper middle (17-42% of the height). The lower-left foreground is a sunlit forest floor.",
    logoStyle: "metal",
    menuStyle: "plain",
    sequence: { logoReveal: "bloom" },
    logoShine: "once",
    transition: { kind: "flash" },
    effects: [
      { kind: "camera", intensity: 0.8 },
      { kind: "mist", region: [[0.37, 0.19], [0.8, 0.17], [0.82, 0.4], [0.36, 0.42]] },
      { kind: "water", region: [[0.518, 0.545], [0.625, 0.535], [0.628, 0.6], [0.515, 0.61]] },
      { kind: "dapple", region: [[0, 0.72], [0.55, 0.62], [0.62, 1], [0, 1]] },
      { kind: "godRays", source: [0.8, -0.06], toward: [0.6, 0.8] },
      { kind: "motes", source: [0.8, -0.06], toward: [0.6, 0.8], count: 70 },
      { kind: "glint", line: [[0.776, 0.335], [0.69, 0.835]] },
    ],
  },
  {
    id: "moonlitCastle",
    label: "달밤 성",
    description: "달빛 빛내림, 창문 불빛 깜빡임, 해자 물결과 달빛 반짝임, 낮은 안개.",
    accent: "#8fb4ff",
    scene:
      "a dark fantasy castle on a cliff under a large full moon at night, warm lit windows, a moat reflecting moonlight in the foreground, low fog around the castle base, deep blue night sky with faint stars",
    layout:
      "The moon sits at about 72% from the left and 12% from the top. The castle stands at 55-70% from the left with lit windows around 36-42% of the height. The moat fills the bottom fifth. Fog lies at 58-80% of the height.",
    logoStyle: "stone",
    menuStyle: "window",
    sequence: { fadeMs: 2200, push: 0.06, logoAtMs: 1500, logoReveal: "fade" },
    logoShine: "loop",
    transition: { kind: "fade", durationMs: 1200 },
    effects: [
      { kind: "camera", intensity: 0.6 },
      { kind: "godRays", source: [0.72, 0.12], toward: [0.6, 0.9], intensity: 0.55, color: "#bcd4ff", spread: 0.3 },
      { kind: "glow", source: [0.58, 0.42], spread: 0.05 },
      { kind: "glow", source: [0.66, 0.36], spread: 0.04, speed: 1.3 },
      { kind: "water", region: [[0.2, 0.8], [0.95, 0.78], [1, 1], [0.15, 1]], color: "#cfe0ff" },
      { kind: "mist", region: [[0.25, 0.6], [1, 0.58], [1, 0.8], [0.2, 0.82]], intensity: 1.2, color: "#9fb0d0" },
      { kind: "motes", region: [[0, 0], [1, 0], [1, 0.5], [0, 0.5]], count: 24, color: "#e6eeff", intensity: 0.45, speed: 0.4 },
    ],
  },
  {
    id: "snowyVillage",
    label: "눈 내리는 마을",
    description: "천천히 떨어지는 눈송이, 따뜻한 창 불빛 둘, 산자락 옅은 안개.",
    accent: "#dfeeff",
    scene:
      "a quiet snowy fantasy village at dusk, warm glowing windows, snow-covered roofs and pine trees, gentle snowfall, mountains behind in soft blue haze",
    layout:
      "Warm windows glow around 55% and 72% from the left at 56-60% of the height. Hazy mountains span 28-55% of the height. The village fills the right two thirds; the left third is open snowy field and sky.",
    logoStyle: "glow",
    menuStyle: "window",
    sequence: { fadeMs: 1800, push: 0.05, logoReveal: "rise" },
    logoShine: "once",
    transition: { kind: "fade" },
    effects: [
      { kind: "camera", intensity: 0.5 },
      { kind: "glow", source: [0.55, 0.6], spread: 0.06 },
      { kind: "glow", source: [0.72, 0.56], spread: 0.05, speed: 0.8 },
      { kind: "mist", region: [[0.1, 0.3], [1, 0.28], [1, 0.52], [0.1, 0.55]], intensity: 0.8, color: "#d6e2f2" },
      { kind: "motes", region: [[0, 0], [1, 0], [1, 1], [0, 1]], count: 80, color: "#ffffff", intensity: 0.9, speed: 0.7 },
    ],
  },
  {
    id: "mistyRuins",
    label: "폐허 안개",
    description: "무너진 신전 사이로 드는 흐린 빛, 떠도는 먼지, 두 겹의 짙은 안개.",
    accent: "#c9c3a8",
    scene:
      "ancient overgrown temple ruins in a deep valley, broken moss-covered pillars, thick drifting fog, a pale shaft of light from the upper left",
    layout:
      "The light shaft enters from the top edge at about 35% from the left and falls down-right. Pillars stand in the right two thirds. Thick fog fills 40-100% of the height.",
    logoStyle: "gold",
    menuStyle: "plain",
    sequence: { fadeMs: 2400, push: 0.1, logoAtMs: 1600, logoReveal: "fade", sweep: false },
    logoShine: "none",
    transition: { kind: "mist" },
    effects: [
      { kind: "camera", intensity: 0.7 },
      { kind: "godRays", source: [0.35, -0.1], toward: [0.55, 0.8], intensity: 0.7, color: "#f2eedd" },
      { kind: "motes", source: [0.35, -0.1], toward: [0.55, 0.8], count: 45, color: "#f4efdc" },
      { kind: "mist", region: [[0.1, 0.45], [1, 0.4], [1, 0.75], [0.1, 0.8]], intensity: 1.4 },
      { kind: "mist", region: [[0, 0.72], [1, 0.7], [1, 1], [0, 1]], intensity: 0.9, speed: 0.6 },
    ],
  },
  {
    id: "sunsetHarbor",
    label: "노을 항구",
    description: "낮게 깔린 석양 빛줄기, 넓은 바다 물결, 수평선 반짝임, 등대 불빛.",
    accent: "#ff9a5a",
    scene:
      "a fantasy harbor town at sunset, a large low orange sun near the horizon, sailing ships at anchor, a lighthouse on a rocky point, the sea shimmering with golden light, warm clouds",
    layout:
      "The sun sits on the horizon at about 62% from the left and 44% of the height. The sea fills the bottom half (48-100% of the height). A lighthouse stands at about 84% from the left with its lamp at 30% of the height. Ships sit around 40-55% from the left. The upper left is open warm sky.",
    logoStyle: "gold",
    menuStyle: "window",
    sequence: { logoReveal: "wipe" },
    logoShine: "once",
    transition: { kind: "flash" },
    effects: [
      { kind: "camera", intensity: 0.6 },
      { kind: "godRays", source: [0.62, 0.44], toward: [0.62, 1.1], intensity: 0.8, color: "#ffb070", spread: 0.45 },
      { kind: "water", region: [[0, 0.5], [1, 0.48], [1, 1], [0, 1]], color: "#ffd9a8", intensity: 1.2 },
      { kind: "glint", line: [[0.45, 0.47], [0.8, 0.47]], color: "#fff1c9", periodSec: 7 },
      { kind: "glow", source: [0.84, 0.3], spread: 0.05, color: "#ffe6a0", speed: 0.6 },
      { kind: "mist", region: [[0, 0.38], [1, 0.36], [1, 0.5], [0, 0.52]], intensity: 0.6, color: "#f7c9a3" },
    ],
  },
  {
    id: "crystalCave",
    label: "수정 동굴",
    description: "푸른·보랏빛 수정 불빛, 떠다니는 빛가루, 지하 호수 물결, 바닥 안개.",
    accent: "#7ee0ff",
    scene:
      "a vast underground crystal cave, huge glowing cyan and violet crystals, a still underground lake reflecting the light, floating sparkles, dark rocky walls framing the scene",
    layout:
      "The largest cyan crystal cluster glows at about 68% from the left and 45% of the height; a violet cluster glows at about 40% from the left and 58%. The lake fills 72-100% of the height across the middle. The left third is darker rock wall.",
    logoStyle: "glow",
    menuStyle: "window",
    sequence: { fadeMs: 1400, logoReveal: "bloom" },
    logoShine: "loop",
    transition: { kind: "zoom" },
    effects: [
      { kind: "camera", intensity: 0.5 },
      { kind: "glow", source: [0.68, 0.45], spread: 0.1, color: "#7ee0ff", intensity: 1.2, speed: 0.5 },
      { kind: "glow", source: [0.4, 0.58], spread: 0.07, color: "#b98cff", speed: 0.7 },
      { kind: "motes", region: [[0.2, 0.15], [1, 0.15], [1, 0.8], [0.2, 0.8]], count: 60, color: "#bff4ff", intensity: 0.9, speed: 0.5 },
      { kind: "water", region: [[0.15, 0.74], [1, 0.72], [1, 1], [0.1, 1]], color: "#bfefff" },
      { kind: "mist", region: [[0, 0.82], [1, 0.8], [1, 1], [0, 1]], intensity: 0.7, color: "#8fb6d8", speed: 0.5 },
    ],
  },
  {
    id: "volcanicFortress",
    label: "화산 요새",
    description: "용암 빛 맥동, 위로 솟는 불티, 검은 연기, 붉은 하늘 빛줄기.",
    accent: "#ff6a2a",
    scene:
      "a dark volcanic fortress of black stone on a lava field, rivers of glowing lava, an erupting volcano behind under a red smoky sky, embers rising into the air",
    layout:
      "The fortress stands at 50-78% from the left. A lava river glows across the bottom (78-100% of the height) and pools at about 60% from the left and 85% of the height. The volcano crater glows at about 70% from the left and 12% of the height. Smoke hangs across 20-45% of the height. The left third is dark rock.",
    logoStyle: "stone",
    menuStyle: "plain",
    sequence: { fadeMs: 1000, push: 0.12, logoAtMs: 800, logoReveal: "wipe" },
    logoShine: "once",
    transition: { kind: "flash", durationMs: 600 },
    effects: [
      { kind: "camera", intensity: 0.9, speed: 1.2 },
      { kind: "glow", source: [0.6, 0.86], spread: 0.16, color: "#ff6a2a", intensity: 1.3, speed: 0.6 },
      { kind: "glow", source: [0.7, 0.12], spread: 0.08, color: "#ff8a3c", speed: 0.9 },
      { kind: "motes", source: [0.6, 1.1], toward: [0.6, 0.1], count: 70, color: "#ff8a3c", speed: 1.6, spread: 0.5 },
      { kind: "mist", region: [[0.1, 0.18], [1, 0.16], [1, 0.46], [0.1, 0.48]], color: "#3a2a28", intensity: 1.3, speed: 0.8 },
      { kind: "godRays", source: [0.7, 0.12], toward: [0.5, 0.9], color: "#ff7040", intensity: 0.5, spread: 0.35 },
    ],
  },
  {
    id: "blossomShrine",
    label: "벚꽃 신사",
    description: "흩날리는 꽃잎, 부드러운 봄 햇살, 연못 물결, 등롱 불빛.",
    accent: "#ffb6cf",
    scene:
      "a serene hilltop shrine in spring, a huge cherry blossom tree in full bloom, pink petals drifting in the wind, a red torii gate, a small koi pond and stone lanterns, soft morning light from the upper left",
    layout:
      "The cherry tree canopy fills the upper right (55-100% from the left, 0-50% of the height). The shrine gate stands at about 60-75% from the left. A stone lantern glows at about 82% from the left and 62% of the height. The pond sits at 40-70% from the left, 80-95% of the height. Soft light enters from the upper left corner.",
    logoStyle: "plain",
    menuStyle: "window",
    sequence: { fadeMs: 2000, push: 0.05, logoReveal: "rise" },
    logoShine: "once",
    transition: { kind: "mist" },
    effects: [
      { kind: "camera", intensity: 0.5 },
      { kind: "godRays", source: [0.1, -0.1], toward: [0.5, 0.8], intensity: 0.5, color: "#fff0e0", spread: 0.3 },
      { kind: "motes", source: [0.9, 0.1], toward: [0.2, 0.9], count: 60, color: "#ffc4d8", intensity: 1.1, speed: 0.9, spread: 0.6 },
      { kind: "water", region: [[0.4, 0.8], [0.7, 0.79], [0.72, 0.95], [0.38, 0.95]], color: "#ffe8f0" },
      { kind: "glow", source: [0.82, 0.62], spread: 0.04, color: "#ffcf8a" },
      { kind: "dapple", region: [[0.5, 0.5], [1, 0.45], [1, 1], [0.45, 1]], intensity: 0.7 },
    ],
  },
  {
    id: "desertOasis",
    label: "사막 오아시스",
    description: "강한 한낮 햇살, 오아시스 물결, 모래 먼지, 지평선 아지랑이.",
    accent: "#e8b86a",
    scene:
      "a golden desert with rolling dunes and an oasis of palm trees around a blue pool, ancient sandstone ruins in the distance, a blazing sun high in the upper right, heat haze on the horizon",
    layout:
      "The sun sits at about 82% from the left just below the top edge. The oasis pool sits at 45-70% from the left, 68-82% of the height. Distant ruins and the horizon lie around 40-50% of the height. Dunes fill the foreground.",
    logoStyle: "gold",
    menuStyle: "plain",
    sequence: { push: 0.07, logoReveal: "wipe" },
    logoShine: "once",
    transition: { kind: "fade" },
    effects: [
      { kind: "camera", intensity: 0.4 },
      { kind: "godRays", source: [0.82, 0.02], toward: [0.5, 0.9], intensity: 0.9, color: "#fff2c4", spread: 0.25 },
      { kind: "water", region: [[0.45, 0.69], [0.7, 0.67], [0.71, 0.82], [0.44, 0.83]], color: "#e6fbff" },
      { kind: "mist", region: [[0, 0.4], [1, 0.38], [1, 0.52], [0, 0.54]], color: "#f4dcae", intensity: 0.8, speed: 1.4 },
      { kind: "motes", region: [[0, 0.5], [1, 0.5], [1, 1], [0, 1]], count: 36, color: "#f1d29a", intensity: 0.6, speed: 1.5 },
    ],
  },
  {
    id: "skyIslands",
    label: "하늘 섬",
    description: "구름 사이로 쏟아지는 빛, 흘러가는 구름띠, 떠다니는 빛 먼지, 폭포 물결.",
    accent: "#9fd8ff",
    scene:
      "floating islands in a bright blue sky, waterfalls pouring off their edges into the clouds, a small castle on the largest island, sea of clouds below, sunbeams breaking through the clouds from the top",
    layout:
      "Sunbeams break through at about 55% from the left above the top edge and fan downward. The largest island floats at 50-85% from the left, 25-60% of the height, with a waterfall at about 62% from the left falling from 55% to 80%. A sea of clouds fills 70-100% of the height.",
    logoStyle: "metal",
    menuStyle: "window",
    sequence: { fadeMs: 1800, push: 0.1, logoAtMs: 1300, logoReveal: "bloom" },
    logoShine: "loop",
    transition: { kind: "zoom" },
    effects: [
      { kind: "camera", intensity: 0.7, speed: 0.8 },
      { kind: "godRays", source: [0.55, -0.12], toward: [0.5, 0.9], intensity: 0.8, color: "#fffbe8", spread: 0.35 },
      { kind: "motes", source: [0.55, -0.12], toward: [0.5, 0.9], count: 50, color: "#ffffff", intensity: 0.7 },
      { kind: "water", region: [[0.6, 0.55], [0.645, 0.55], [0.65, 0.8], [0.595, 0.8]], color: "#ffffff", intensity: 1.4, speed: 1.6 },
      { kind: "mist", region: [[0, 0.7], [1, 0.68], [1, 1], [0, 1]], color: "#ffffff", intensity: 1.3, speed: 0.7 },
    ],
  },
];

export function findTitleOpeningPreset(id: string): TitleOpeningPreset | undefined {
  return TITLE_OPENING_PRESETS.find((preset) => preset.id === id);
}

/** 프리셋 효과의 깊은 사본(정규화 거침). */
export function titleOpeningPresetEffects(preset: TitleOpeningPreset): TitleEffect[] {
  return normalizeTitleEffects(JSON.parse(JSON.stringify(preset.effects))) ?? [];
}
