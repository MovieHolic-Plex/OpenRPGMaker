// project/battleLook.ts — 전투 화면 꾸미기(프리셋 + 칸별 조절)의 단일 진실 공급원.
//
// 스킨(battleUiStyle)은 전투 방식(정면·측면·몬스터 대치)과 배틀러 배치를, 꾸미기는 그 위의 **화면**을 정한다.
// 2026-10-01 전까지 측면 스킨은 같은 파란 각진 판에 색만 달라서(사용자: "파란 패널로만 뜨는 게 불만")
// 화면을 축으로 나눴다: 파티 상태 · 명령 · 전장 크기 · 차례 줄 · 적 이름표 · 영화 띠 · 창 꾸밈 · 글꼴 · 강조색 · 무대 연출.
// 프리셋은 그 축 전부의 묶음이고, 저장값은 { preset, ...바꾼 칸 } 이다. 칸 하나만 바꿔도 프리셋은 남는다.
// 프리셋 12종은 다른 게임들의 전투 배치를 조사해 옮겼다(~/claude-viz/battle-look-editor.html, battle-layouts.html).
// 사용자 노출 라벨에는 다른 회사 게임 이름을 쓰지 않는다(test/detsukuruBrandStrings.test.ts).
// 도트 측면 전투(motionStyle "retro")에만 걸린다. DOM 은 만지지 않는다 — player/battleLookDom.ts 가 루트에 옮긴다.
import { isFontFamilyId, resolveFontStack, type FontFamilyId } from "@/project/fontRegistry";

export const BATTLE_LOOK_PARTY_IDS = ["rows", "compact", "cards", "boxesTop", "boxesBottom", "mini", "tilt"] as const;
export type BattleLookParty = (typeof BATTLE_LOOK_PARTY_IDS)[number];
export const BATTLE_LOOK_COMMAND_IDS = ["corner", "actor", "top", "fan", "keys", "icons"] as const;
export type BattleLookCommand = (typeof BATTLE_LOOK_COMMAND_IDS)[number];
export const BATTLE_LOOK_FIELD_IDS = ["band", "full"] as const;
export type BattleLookField = (typeof BATTLE_LOOK_FIELD_IDS)[number];
export const BATTLE_LOOK_WINDOW_IDS = ["pixel", "line", "teal", "pattern", "ink", "gold", "parch", "veil", "soft", "pop", "bare"] as const;
export type BattleLookWindow = (typeof BATTLE_LOOK_WINDOW_IDS)[number];
export const BATTLE_LOOK_LEVELS = [0, 1, 2] as const;
export type BattleLookLevel = (typeof BATTLE_LOOK_LEVELS)[number];

export const BATTLE_LOOK_PARTY_LABELS: Readonly<Record<BattleLookParty, string>> = {
  rows: "줄 목록", compact: "작은 창", cards: "초상 카드", boxesTop: "위 상자", boxesBottom: "아래 상자", mini: "위 작은 상자", tilt: "기울인 초상",
};
export const BATTLE_LOOK_COMMAND_LABELS: Readonly<Record<BattleLookCommand, string>> = {
  corner: "왼쪽 아래 창", actor: "캐릭터 옆 창", top: "위쪽 가로", fan: "사선 블록", keys: "버튼 네 개", icons: "아이콘 줄",
};
export const BATTLE_LOOK_FIELD_LABELS: Readonly<Record<BattleLookField, string>> = { band: "창 위까지", full: "화면 끝까지" };
export const BATTLE_LOOK_WINDOW_LABELS: Readonly<Record<BattleLookWindow, string>> = {
  pixel: "도트 창 (청색 각진)", line: "흰 줄 둥근 창", teal: "청람 창", pattern: "무늬 창", ink: "먹빛 금테", gold: "화려한 금테",
  parch: "양피지", veil: "얇은 장막", soft: "부드러운 둥근 창", pop: "강렬한 사선", bare: "테 없음",
};
export const BATTLE_LOOK_LEVEL_LABELS: Readonly<Record<BattleLookLevel, string>> = { 0: "끔", 1: "약하게", 2: "강하게" };

/** 고전 창(도트 창 계열)은 장갑 커서·픽셀 글꼴 등 도트 창 속을 그대로 쓰고 겉판만 바꾼다. 나머지는 현대 창 속(마름모 커서·가는 게이지). */
export const BATTLE_LOOK_RETRO_WINDOWS: readonly BattleLookWindow[] = ["pixel", "line", "teal", "pattern"];

/** 창 꾸밈마다의 기본 글꼴. undefined = 프로젝트 픽셀 글꼴(system.fonts.pixel). */
export const BATTLE_LOOK_WINDOW_FONTS: Readonly<Record<BattleLookWindow, FontFamilyId | undefined>> = {
  pixel: undefined, line: undefined, teal: undefined, pattern: undefined,
  ink: "myeongjo", gold: "myeongjo", parch: "myeongjo", bare: "myeongjo",
  veil: "system-sans", pop: "system-sans", soft: "rounded",
};

export interface BattleLookAxes {
  readonly party: BattleLookParty;
  readonly command: BattleLookCommand;
  readonly field: BattleLookField;
  readonly turnOrder: boolean;
  readonly enemyNames: boolean;
  readonly letterbox: boolean;
  readonly window: BattleLookWindow;
  /** 생략 = 창 꾸밈 기본 글꼴. */
  readonly font?: FontFamilyId;
  /** #rrggbb. 생략 = 창 꾸밈 기본 강조색(CSS). */
  readonly accent?: string;
  readonly light: BattleLookLevel;
  readonly dust: BattleLookLevel;
  readonly vignette: BattleLookLevel;
  readonly blur: BattleLookLevel;
  readonly grade: boolean;
}

/** 저장 모양: 프리셋 id + 프리셋과 다르게 고른 칸만. 생략 = pixel 프리셋 그대로. */
export type BattleLookSettings = { preset?: BattleLookPresetId } & { -readonly [K in keyof BattleLookAxes]?: BattleLookAxes[K] };

const BASE: BattleLookAxes = {
  party: "rows", command: "corner", field: "band", turnOrder: false, enemyNames: false, letterbox: false,
  window: "pixel", light: 0, dust: 0, vignette: 0, blur: 0, grade: false,
};

export interface BattleLookPreset {
  readonly label: string;
  readonly summary: string;
  readonly description: string;
  readonly group: "classic" | "fantasy" | "modern";
  readonly axes: BattleLookAxes;
}

export const BATTLE_LOOK_PRESET_IDS = ["pixel", "line", "teal", "pattern", "ink", "gold", "parch", "icons", "veil", "soft", "pop", "cinema"] as const;
export type BattleLookPresetId = (typeof BATTLE_LOOK_PRESET_IDS)[number];
export const DEFAULT_BATTLE_LOOK_PRESET: BattleLookPresetId = "pixel";

export const BATTLE_LOOK_GROUP_LABELS: Readonly<Record<BattleLookPreset["group"], string>> = {
  classic: "고전 도트", fantasy: "고급 · 판타지", modern: "현대 · 연출형",
};

export const BATTLE_LOOK_PRESETS: Readonly<Record<BattleLookPresetId, BattleLookPreset>> = {
  pixel: { group: "classic", label: "도트 창 (기본)", summary: "아래 두 창", description: "아래쪽에 명령 창과 파티 줄 목록. 청색 각진 창과 픽셀 글꼴.", axes: BASE },
  line: { group: "classic", label: "흰 줄 상자", summary: "위쪽 파티 상자", description: "파티를 위쪽 상자 넷에, 명령과 메시지를 아래에. 검은 바탕에 흰 줄 둥근 창.", axes: { ...BASE, party: "boxesTop", window: "line" } },
  teal: { group: "classic", label: "청람 작은 창", summary: "전장 그대로 · 작은 창", description: "전장을 화면 끝까지 쓰고 오른쪽 아래 작은 상태 창과 캐릭터 옆 명령 창. 행동 게이지가 눈에 띈다.", axes: { ...BASE, party: "compact", command: "actor", field: "full", window: "teal" } },
  pattern: { group: "classic", label: "무늬 상자", summary: "굴러가는 숫자", description: "아래 개인 상자에 HP 를 숫자 바퀴로 보이고 명령은 위쪽 가로 줄. 무늬 바탕 창.", axes: { ...BASE, party: "boxesBottom", command: "top", window: "pattern" } },
  ink: { group: "fantasy", label: "먹빛 금테", summary: "판 없는 어두운 띠", description: "판 없이 가장자리로 흐려지는 먹빛 띠와 가는 금선. 명조 글꼴.", axes: { ...BASE, window: "ink", vignette: 1, grade: true } },
  gold: { group: "fantasy", label: "화려한 금테", summary: "초상 카드 · 차례 줄 · 빛", description: "초상 카드, 캐릭터 옆 명령 창, 차례 순서 줄, 적 이름표, 빛내림과 먼지. 금 장식 창.", axes: { ...BASE, party: "cards", command: "actor", field: "full", turnOrder: true, enemyNames: true, window: "gold", light: 2, dust: 2, vignette: 2, blur: 2, grade: true } },
  parch: { group: "fantasy", label: "양피지", summary: "동화책 느낌", description: "크림색 종이 창과 갈색 글씨, 명조. 초상 카드와 차례 줄, 은은한 빛.", axes: { ...BASE, party: "cards", command: "actor", turnOrder: true, window: "parch", light: 1, vignette: 1, grade: true } },
  icons: { group: "fantasy", label: "아이콘 줄", summary: "위 작은 상자 · 둥근 아이콘", description: "파티는 오른쪽 위 작은 상자, 명령은 아래 둥근 아이콘 줄(고른 것만 이름이 뜬다).", axes: { ...BASE, party: "mini", command: "icons", field: "full", window: "teal", font: "rounded", light: 1 } },
  veil: { group: "modern", label: "얇은 장막", summary: "반투명 · 무대가 잘 보임", description: "반투명 판과 흰 실선만. 가장 덜 꾸민 화면.", axes: { ...BASE, window: "veil" } },
  soft: { group: "modern", label: "버튼 네 개", summary: "부드러운 둥근 창", description: "캐릭터 옆에 버튼 네 개(마름모)와 누를 키. 둥근 창, 둥근 고딕, 초상 카드와 차례 줄.", axes: { ...BASE, party: "cards", command: "keys", field: "full", turnOrder: true, window: "soft", vignette: 1, dust: 1, grade: true } },
  pop: { group: "modern", label: "강렬한 사선", summary: "스타일리시", description: "사선으로 쌓인 큰 명령 블록과 기울인 초상. 빨강 · 검정 · 흰색.", axes: { ...BASE, party: "tilt", command: "fan", field: "full", window: "pop", vignette: 1 } },
  cinema: { group: "modern", label: "영화식", summary: "테 없음 · 영화 띠", description: "위아래 검은 띠, 창 테두리 없이 글자만. 흐림과 빛으로 장면을 살린다.", axes: { ...BASE, party: "compact", command: "actor", field: "full", letterbox: true, window: "bare", light: 1, vignette: 2, blur: 2, grade: true } },
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const isOneOf = <T extends string>(ids: readonly T[], value: unknown): value is T => typeof value === "string" && (ids as readonly string[]).includes(value);
const isLevel = (value: unknown): value is BattleLookLevel => value === 0 || value === 1 || value === 2;

export function isBattleLookPresetId(value: unknown): value is BattleLookPresetId {
  return isOneOf(BATTLE_LOOK_PRESET_IDS, value);
}

export function isBattleAccentColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

/**
 * 저장 정규화 — 알 수 없는 칸은 버리고, 프리셋과 같은 값은 지운다(기본값은 저장하지 않는 계약).
 * 결과가 pixel 프리셋 그대로면 undefined.
 */
export function normalizeBattleLook(value: unknown): BattleLookSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const preset = isBattleLookPresetId(raw.preset) ? raw.preset : DEFAULT_BATTLE_LOOK_PRESET;
  const base = BATTLE_LOOK_PRESETS[preset].axes;
  const out: BattleLookSettings = {};
  if (preset !== DEFAULT_BATTLE_LOOK_PRESET) out.preset = preset;
  const pick = <K extends keyof BattleLookAxes>(key: K, valid: (v: unknown) => v is BattleLookAxes[K]): void => {
    const candidate = key === "accent" && typeof raw[key] === "string" ? (raw[key] as string).toLowerCase() : raw[key];
    if (valid(candidate) && candidate !== base[key]) (out as Record<string, unknown>)[key] = candidate;
  };
  pick("party", (v): v is BattleLookParty => isOneOf(BATTLE_LOOK_PARTY_IDS, v));
  pick("command", (v): v is BattleLookCommand => isOneOf(BATTLE_LOOK_COMMAND_IDS, v));
  pick("field", (v): v is BattleLookField => isOneOf(BATTLE_LOOK_FIELD_IDS, v));
  pick("window", (v): v is BattleLookWindow => isOneOf(BATTLE_LOOK_WINDOW_IDS, v));
  pick("turnOrder", (v): v is boolean => typeof v === "boolean");
  pick("enemyNames", (v): v is boolean => typeof v === "boolean");
  pick("letterbox", (v): v is boolean => typeof v === "boolean");
  pick("grade", (v): v is boolean => typeof v === "boolean");
  pick("font", (v): v is FontFamilyId => isFontFamilyId(v));
  pick("accent", (v): v is string => isBattleAccentColor(v));
  for (const key of ["light", "dust", "vignette", "blur"] as const) pick(key, isLevel);
  return Object.keys(out).length ? out : undefined;
}

export interface ResolvedBattleLook extends BattleLookAxes {
  /** 저장된 프리셋. 칸을 바꿨어도 바탕 프리셋 id 는 남는다. */
  readonly preset: BattleLookPresetId;
  /** 프리셋에서 칸 하나라도 바꿨는가(편집기 「사용자 설정」 표시). */
  readonly customized: boolean;
  /** 실제로 쓰는 글꼴 스택. undefined = 프로젝트 픽셀 글꼴을 그대로 둔다. */
  readonly fontStack?: string;
  readonly retroWindow: boolean;
}

export function resolveBattleLook(value: unknown): ResolvedBattleLook {
  const saved = normalizeBattleLook(value) ?? {};
  const preset = saved.preset ?? DEFAULT_BATTLE_LOOK_PRESET;
  const { preset: _preset, ...overrides } = saved;
  const axes: BattleLookAxes = { ...BATTLE_LOOK_PRESETS[preset].axes, ...overrides };
  const font = axes.font ?? BATTLE_LOOK_WINDOW_FONTS[axes.window];
  return {
    ...axes,
    preset,
    customized: Object.keys(overrides).length > 0,
    ...(font ? { fontStack: resolveFontStack(font) } : {}),
    retroWindow: BATTLE_LOOK_RETRO_WINDOWS.includes(axes.window),
  };
}

/** 편집기·조수가 칸 하나를 바꿀 때: 프리셋은 두고 그 칸만 덮는다. 정규화가 프리셋과 같은 값은 지운다. */
export function patchBattleLook(current: unknown, patch: Partial<BattleLookSettings>): BattleLookSettings | undefined {
  const base = normalizeBattleLook(current) ?? {};
  const next: Record<string, unknown> = { ...base, ...patch };
  for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key];
  return normalizeBattleLook(next);
}

/** 프리셋을 고를 때: 바꾼 칸을 모두 버린다. */
export function battleLookForPreset(preset: BattleLookPresetId): BattleLookSettings | undefined {
  return normalizeBattleLook({ preset });
}
