/**
 * 필드 연출 어휘 — 레터박스 · 화면 흔들기 방향 · 파티클 · 캐릭터 모습 효과.
 *
 * 왜 한곳에 두는가: 이 값들은 이벤트 명령(편집기 폼), 컷신 비트(조수 도구), 런타임 렌더러,
 * 세이브가 같은 이름을 써야 한다. 이름·범위·기본값이 갈라지면 조수가 고른 값이 런타임에서
 * 조용히 사라진다(#1856 의 distort 비트가 겪은 일). 그래서 정본을 여기 하나로 둔다.
 */

// ── 레터박스 ─────────────────────────────────────────────────────

/** 화면 위아래 검은 띠의 두께(화면 높이 %, 띠 하나). 0 = 없음. */
export const LETTERBOX_LIMITS = { min: 0, max: 25 } as const;
/** 값을 비웠을 때 — 2.35:1 비슷한 영화 비율이 되는 두께. */
export const LETTERBOX_DEFAULT_PERCENT = 12;

export function normalizeLetterboxPercent(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(LETTERBOX_LIMITS.min, Math.min(LETTERBOX_LIMITS.max, numeric));
}

/** 「화면 효과」 의 letterbox 값 문자열 → 띠 두께. 빈 값 = 기본 두께. */
export function letterboxPercentFromValue(value: string): number {
  return value.trim() === "" ? LETTERBOX_DEFAULT_PERCENT : normalizeLetterboxPercent(value, LETTERBOX_DEFAULT_PERCENT);
}

// ── 화면 흔들기 방향 ──────────────────────────────────────────────

export const SHAKE_DIRECTIONS = ["both", "horizontal", "vertical"] as const;
export type ShakeDirection = (typeof SHAKE_DIRECTIONS)[number];
export const SHAKE_DIRECTION_LABELS: Record<ShakeDirection, string> = {
  both: "사방 (충격·폭발)",
  horizontal: "가로 (부딪힘·휘청임)",
  vertical: "세로 (지진·쿵 하는 발소리)",
};

export function normalizeShakeDirection(value: unknown): ShakeDirection {
  return typeof value === "string" && (SHAKE_DIRECTIONS as readonly string[]).includes(value) ? (value as ShakeDirection) : "both";
}

// ── 파티클 ──────────────────────────────────────────────────────

export const PARTICLE_PRESETS = ["sparkle", "magic", "heal", "fire", "smoke", "dust", "explosion", "splash"] as const;
export type ParticlePreset = (typeof PARTICLE_PRESETS)[number];
export const PARTICLE_PRESET_LABELS: Record<ParticlePreset, string> = {
  sparkle: "반짝임 (보물·축복·변신)",
  magic: "마법 기운 (주문·봉인·소환)",
  heal: "회복 빛 (치유·정화)",
  fire: "불티 (모닥불·불꽃·분노)",
  smoke: "연기 (사라짐·굴뚝·화재)",
  dust: "흙먼지 (착지·달리기 멈춤·붕괴)",
  explosion: "폭발 (폭탄·충돌)",
  splash: "물보라 (물에 빠짐·분수)",
};

export function isParticlePreset(value: unknown): value is ParticlePreset {
  return typeof value === "string" && (PARTICLE_PRESETS as readonly string[]).includes(value);
}

export const PARTICLE_DURATION_LIMITS = { min: 100, max: 60_000 } as const;
export const PARTICLE_DEFAULT_DURATION_MS = 1200;

export function normalizeParticleDurationMs(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return PARTICLE_DEFAULT_DURATION_MS;
  return Math.round(Math.max(PARTICLE_DURATION_LIMITS.min, Math.min(PARTICLE_DURATION_LIMITS.max, numeric)));
}

// ── 캐릭터 모습 효과 ─────────────────────────────────────────────

/**
 * 포즈 — 캐릭터 칩에 없는 자세를 그림 변형으로 낸다.
 * - fallen: 옆으로 쓰러짐(90° 눕힘, 발밑 줄에 몸이 눕는다). 기절·사망·잠.
 * - fallenLeft: 반대쪽으로 쓰러짐.
 * - crouch: 웅크림(세로 75%). 숨기·무릎 꿇기·지침.
 * - float: 둥실 뜸(위아래로 천천히 오르내림). 유령·꿈·마법 부양.
 */
export const SPRITE_POSES = ["normal", "fallen", "fallenLeft", "crouch", "float"] as const;
export type SpritePose = (typeof SPRITE_POSES)[number];
export const SPRITE_POSE_LABELS: Record<SpritePose, string> = {
  normal: "보통",
  fallen: "쓰러짐 (기절·잠)",
  fallenLeft: "쓰러짐 (반대쪽)",
  crouch: "웅크림 (숨기·무릎)",
  float: "둥실 뜸 (유령·부양)",
};

/** 저장되는 모습 효과. 빈 객체 = 효과 없음. */
export type SpriteLook = {
  /** 색 곱하기(#rrggbb). 빨강 = 독·분노, 파랑 = 밤·한기. */
  readonly tint?: string;
  /** true 면 tint 색으로 통째로 칠한다(실루엣·피격 번쩍임). */
  readonly tintFill?: boolean;
  readonly flip?: boolean;
  /** 기울기(도). pose 와 함께 쓰면 더해진다. */
  readonly angle?: number;
  readonly pose?: Exclude<SpritePose, "normal">;
  /** 움직일 때 남는 잔상(빠른 이동·순간이동·유령). */
  readonly afterimage?: boolean;
  /** 불투명도 0~1(유령·투명화). 생략 = 1. */
  readonly alpha?: number;
};

const HEX = /^#?([0-9a-f]{6})$/iu;

function normalizeHex(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = HEX.exec(value.trim());
  return match ? `#${match[1]!.toLowerCase()}` : undefined;
}

/** 이름 있는 색 — 조수와 폼이 #rrggbb 를 몰라도 쓸 수 있게. */
export const SPRITE_TINT_NAMES: Record<string, string> = {
  red: "#ff6060",
  blue: "#6080ff",
  green: "#70ff70",
  yellow: "#ffe060",
  purple: "#c070ff",
  gray: "#909090",
  black: "#000000",
  white: "#ffffff",
};

export function spriteTintHex(value: unknown): string | undefined {
  if (typeof value === "string" && SPRITE_TINT_NAMES[value.trim().toLowerCase()]) return SPRITE_TINT_NAMES[value.trim().toLowerCase()];
  return normalizeHex(value);
}

function finiteNumber(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : undefined;
}

function boolish(value: unknown): boolean | undefined {
  if (value === true || value === "true" || value === "on") return true;
  if (value === false || value === "false" || value === "off") return false;
  return undefined;
}

/** 저장·불러오기용 정규화. 기본값(효과 없음)인 칸은 지운다. */
export function normalizeSpriteLook(value: unknown): SpriteLook {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const tint = spriteTintHex(raw.tint);
  const angle = finiteNumber(raw.angle);
  const alpha = finiteNumber(raw.alpha);
  const pose = typeof raw.pose === "string" && (SPRITE_POSES as readonly string[]).includes(raw.pose) && raw.pose !== "normal"
    ? (raw.pose as Exclude<SpritePose, "normal">)
    : undefined;
  const tintFill = tint !== undefined && raw.tintFill === true;
  // 흰색 곱하기는 원래 색이라 저장하지 않는다. 흰색 칠하기(번쩍임)는 효과다.
  const keepTint = tint !== undefined && (tint !== "#ffffff" || tintFill);
  return {
    ...(keepTint ? { tint } : {}),
    ...(keepTint && tintFill ? { tintFill: true } : {}),
    ...(raw.flip === true ? { flip: true } : {}),
    ...(angle !== undefined && angle % 360 !== 0 ? { angle: Math.max(-360, Math.min(360, angle)) } : {}),
    ...(pose ? { pose } : {}),
    ...(raw.afterimage === true ? { afterimage: true } : {}),
    ...(alpha !== undefined && alpha < 1 ? { alpha: Math.max(0, Math.min(1, alpha)) } : {}),
  };
}

export function isEmptySpriteLook(look: SpriteLook | undefined): boolean {
  return !look || Object.keys(look).length === 0;
}

/**
 * 「모습 효과」 명령 필드 → 다음 모습. 필드가 없거나 "keep" 인 칸은 앞 모습을 잇고,
 * reset 이 켜져 있으면 전부 지운 뒤 나머지 칸을 적용한다(«원래대로 + 빨갛게» 를 한 명령으로).
 */
export function nextSpriteLook(current: SpriteLook | undefined, fields: Readonly<Record<string, unknown>>): SpriteLook {
  const base: Record<string, unknown> = boolish(fields.reset) ? {} : { ...(current ?? {}) };
  // 직접 색(tintHex)이 있으면 선택지보다 앞선다 — 선택지는 이름 있는 색만 고를 수 있다.
  const hexField = typeof fields.tintHex === "string" ? fields.tintHex.trim() : "";
  const tintValue = hexField !== "" ? hexField : typeof fields.tint === "string" ? fields.tint.trim() : fields.tint;
  if (tintValue === "none" || tintValue === "clear") {
    delete base.tint;
    delete base.tintFill;
  } else if (tintValue !== undefined && tintValue !== "" && tintValue !== "keep") {
    const hex = spriteTintHex(tintValue);
    if (hex) base.tint = hex;
  }
  const tintFill = boolish(fields.tintFill);
  if (tintFill !== undefined) base.tintFill = tintFill;
  const flip = boolish(fields.flip);
  if (flip !== undefined) base.flip = flip;
  const angle = finiteNumber(fields.angle);
  if (angle !== undefined) base.angle = angle;
  if (typeof fields.pose === "string" && fields.pose !== "" && fields.pose !== "keep") base.pose = fields.pose;
  const afterimage = boolish(fields.afterimage);
  if (afterimage !== undefined) base.afterimage = afterimage;
  const opacity = finiteNumber(fields.opacity);
  // 폼은 불투명도를 0~100 % 로 받는다.
  if (opacity !== undefined) base.alpha = opacity / 100;
  return normalizeSpriteLook(base);
}

/** 모습 효과 저장 키 — 주인공은 맵을 따라다니고, 이벤트는 맵마다 따로다. */
export function spriteLookKey(target: { readonly kind: "player" } | { readonly kind: "event"; readonly mapId: string; readonly eventId: string }): string {
  return target.kind === "player" ? "player" : `${target.mapId}/${target.eventId}`;
}
