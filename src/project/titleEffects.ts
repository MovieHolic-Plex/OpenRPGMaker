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
  TitleLogoStyle,
  TitleMenuStyle,
  TitleScreenSettings,
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

/** normalizeTitleScreenSettings 가 펼쳐 넣는 오프닝 확장 필드 묶음(전부 omit-when-empty). */
export function normalizeTitleOpeningFields(
  settings: Partial<TitleScreenSettings> | undefined,
): Pick<TitleScreenSettings, "backgroundFit" | "backgroundRendering" | "effects" | "logoStyle" | "logoSubtitle" | "menuStyle"> {
  const backgroundFit = normalizeTitleBackgroundFit(settings?.backgroundFit);
  const backgroundRendering = normalizeTitleBackgroundRendering(settings?.backgroundRendering);
  const effects = normalizeTitleEffects(settings?.effects);
  const logoStyle = normalizeTitleLogoStyle(settings?.logoStyle);
  const logoSubtitle = normalizeTitleLogoSubtitle(settings?.logoSubtitle);
  const menuStyle = normalizeTitleMenuStyle(settings?.menuStyle);
  return {
    ...(backgroundFit ? { backgroundFit } : {}),
    ...(backgroundRendering ? { backgroundRendering } : {}),
    ...(effects ? { effects } : {}),
    ...(logoStyle ? { logoStyle } : {}),
    ...(logoSubtitle ? { logoSubtitle } : {}),
    ...(menuStyle ? { menuStyle } : {}),
  };
}

/** 켜져 있는 효과만. */
export function activeTitleEffects(effects: readonly TitleEffect[] | undefined): TitleEffect[] {
  return (effects ?? []).filter((effect) => effect.enabled !== false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 프리셋 — 구도가 비슷한 그림에 바로 얹을 수 있는 출발점. 좌표는 편집기에서 끌어 맞춘다.
// ─────────────────────────────────────────────────────────────────────────────

export interface TitleOpeningPreset {
  id: string;
  label: string;
  description: string;
  /** AI 키아트 프롬프트에 쓰는 장면 묘사(영문). */
  scene: string;
  /** 효과 좌표와 맞는 구도 지시(영문). 생성 그림이 프리셋 좌표에 가깝게 나오게 한다. */
  layout: string;
  logoStyle: TitleLogoStyle;
  menuStyle: TitleMenuStyle;
  effects: TitleEffect[];
}

export const TITLE_OPENING_PRESETS: readonly TitleOpeningPreset[] = [
  {
    id: "forestMorning",
    label: "숲 아침 햇살",
    description: "나무 사이 빛내림과 먼지, 칼날 반사, 먼 강 물결, 산 안개.",
    scene:
      "a sunlit fantasy forest clearing at morning, two swords leaning against a large tree on the right, a distant castle town on a river with a stone bridge, misty mountains far behind, strong sun rays through the canopy from the upper right",
    layout:
      "The sun sits just above the top edge at about 80% from the left, its rays falling down-left. The swords lean on the tree trunk at about 70-78% from the left, blades running from 34% to 83% of the height. The river and bridge sit at about 52-63% from the left and 54-61% of the height. Mountains and mist span the upper middle (17-42% of the height). The lower-left foreground is a sunlit forest floor.",
    logoStyle: "metal",
    menuStyle: "plain",
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
    description: "달빛 빛내림, 성 창문 불빛 깜빡임, 해자 물결, 낮은 안개.",
    scene:
      "a dark fantasy castle on a cliff under a large full moon at night, warm lit windows, a moat reflecting moonlight in the foreground, low fog around the castle base",
    layout:
      "The moon sits at about 72% from the left and 12% from the top. The castle stands at 55-70% from the left with lit windows around 36-42% of the height. The moat fills the bottom fifth. Fog lies at 58-80% of the height.",
    logoStyle: "stone",
    menuStyle: "plain",
    effects: [
      { kind: "camera", intensity: 0.6 },
      { kind: "godRays", source: [0.72, 0.12], toward: [0.6, 0.9], intensity: 0.55, color: "#bcd4ff", spread: 0.3 },
      { kind: "glow", source: [0.58, 0.42], spread: 0.05 },
      { kind: "glow", source: [0.66, 0.36], spread: 0.04, speed: 1.3 },
      { kind: "water", region: [[0.2, 0.8], [0.95, 0.78], [1, 1], [0.15, 1]] },
      { kind: "mist", region: [[0.25, 0.6], [1, 0.58], [1, 0.8], [0.2, 0.82]], intensity: 1.2 },
    ],
  },
  {
    id: "snowyVillage",
    label: "눈 내리는 마을",
    description: "창 불빛과 차가운 먼지, 옅은 안개. 눈 입자와 함께 쓰면 좋다.",
    scene:
      "a quiet snowy fantasy village at dusk, warm glowing windows, snow-covered roofs and pine trees, mountains behind in soft haze",
    layout:
      "Warm windows glow around 55% and 72% from the left at 56-60% of the height. Hazy mountains span 28-55% of the height. The village fills the right two thirds.",
    logoStyle: "glow",
    menuStyle: "plain",
    effects: [
      { kind: "camera", intensity: 0.5 },
      { kind: "glow", source: [0.55, 0.6], spread: 0.06 },
      { kind: "glow", source: [0.72, 0.56], spread: 0.05, speed: 0.8 },
      { kind: "mist", region: [[0.3, 0.3], [1, 0.28], [1, 0.52], [0.3, 0.55]], intensity: 0.8 },
      { kind: "motes", region: [[0.3, 0], [1, 0], [1, 1], [0.3, 1]], count: 40, color: "#eef6ff", intensity: 0.7 },
    ],
  },
  {
    id: "mistyRuins",
    label: "폐허 안개",
    description: "무너진 신전 사이로 드는 흐린 빛과 짙은 안개.",
    scene:
      "ancient overgrown temple ruins in a deep valley, broken pillars, thick drifting fog, a pale shaft of light from the upper left",
    layout:
      "The light shaft enters from the top edge at about 35% from the left and falls down-right. Pillars stand in the right two thirds. Thick fog fills 40-100% of the height.",
    logoStyle: "gold",
    menuStyle: "plain",
    effects: [
      { kind: "camera", intensity: 0.7 },
      { kind: "godRays", source: [0.35, -0.1], toward: [0.55, 0.8], intensity: 0.7, color: "#f2eedd" },
      { kind: "motes", source: [0.35, -0.1], toward: [0.55, 0.8], count: 45 },
      { kind: "mist", region: [[0.3, 0.45], [1, 0.4], [1, 0.75], [0.3, 0.8]], intensity: 1.4 },
      { kind: "mist", region: [[0.3, 0.72], [1, 0.7], [1, 1], [0.3, 1]], intensity: 0.9, speed: 0.6 },
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
