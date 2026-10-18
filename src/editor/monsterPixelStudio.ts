// 도트 몬스터 공방 — retro2003 적 9칸 전투 시트(3×3) 합성기. 편집기 대화상자와 AI 도구(author_enemy_pixel_sheet)가 같이 쓴다.
//
// 시트 계약은 src/assets/pixelEnemySheets.ts 와 같다: cell px 정사각 3×3, 1:1 도트, 알파 0/255, 오른쪽(아군 쪽)을 본다,
// 바닥 기준선 y = cell−4. (0,0)(1,0)(2,0) 대기 a·b·c · (0,1) windup (1,1) move (2,1) attack · (0,2) 스킬 (1,2) hit (2,2) dead.
//
// 그림 방식은 scripts/asset-gen/pixel-enemy/pe_rig.py(관절 리그 + 최종 격자 직접 찍기)를 옮겼다:
//   부위마다 마스크(타원·다각형·굵은 획)를 만들고 → 1px 외곽선 → 왼쪽 위 빛 기준 3단 셀 음영으로 칠한다.
//   몸통·머리·팔다리 위치는 자세 표(POSES)의 숫자로만 움직인다 — 같은 원형이면 9칸이 같은 몸으로 읽힌다.
// 모드 B: cells 에 칸별 문자 격자를 주면 그 칸은 그대로 찍고, 빠진 칸은 원형 리그(있으면) 또는 준 칸의 변형으로 채운다.
//
// 브라우저·Node 공용(캔버스 없음). PNG 는 팔레트 PNG(src/util/indexedPng.ts).
import type { PixelEnemyCell, PixelEnemyMotion } from "@/assets/pixelEnemySheets";
import { encodeIndexedPng, pngDataUrl } from "@/util/indexedPng";

export const MONSTER_ARCHETYPES = ["beast", "humanoid-knight", "winged-fiend", "slime-ooze", "golem-construct", "plant-hydra", "dragon-boss", "caster-wraith"] as const;
export type MonsterArchetype = (typeof MONSTER_ARCHETYPES)[number];
export const MONSTER_WEAPONS = ["sword", "axe", "spear", "claw", "staff", "fang", "breath"] as const;
export type MonsterWeapon = (typeof MONSTER_WEAPONS)[number];
export const MONSTER_SHEET_CELLS = [48, 64, 96] as const;
export type MonsterSheetCell = (typeof MONSTER_SHEET_CELLS)[number];
export const MONSTER_MOTIONS: readonly PixelEnemyMotion[] = ["hop", "swoop", "stomp", "dash", "float", "shoot", "breath"];
/** 시트 순서(좌→우, 위→아래). recover 자리는 스킬 칸이다(skillCell). */
export const MONSTER_SHEET_ORDER: readonly PixelEnemyCell[] = ["idle_a", "idle_b", "idle_c", "windup", "move", "attack", "recover", "hit", "dead"];

export const MONSTER_ARCHETYPE_LABELS: Readonly<Record<MonsterArchetype, string>> = {
  beast: "네발 짐승",
  "humanoid-knight": "인간형 검사",
  "winged-fiend": "날개 악마",
  "slime-ooze": "슬라임",
  "golem-construct": "골렘",
  "plant-hydra": "식물 히드라",
  "dragon-boss": "드래곤",
  "caster-wraith": "망령 술사",
};
export const MONSTER_WEAPON_LABELS: Readonly<Record<MonsterWeapon, string>> = {
  sword: "검", axe: "도끼", spear: "창", claw: "발톱", staff: "지팡이", fang: "송곳니", breath: "숨결",
};

/** 원형마다 기본 무기·접근 방식·대기 칸 길이·비행 여부. */
export const ARCHETYPE_DEFAULTS: Readonly<Record<MonsterArchetype, { readonly weapon: MonsterWeapon; readonly motion: PixelEnemyMotion; readonly idleFrameMs: number; readonly flying: boolean; readonly cell: MonsterSheetCell }>> = {
  beast: { weapon: "fang", motion: "dash", idleFrameMs: 200, flying: false, cell: 64 },
  "humanoid-knight": { weapon: "sword", motion: "dash", idleFrameMs: 200, flying: false, cell: 64 },
  "winged-fiend": { weapon: "claw", motion: "swoop", idleFrameMs: 180, flying: true, cell: 64 },
  "slime-ooze": { weapon: "fang", motion: "hop", idleFrameMs: 220, flying: false, cell: 48 },
  "golem-construct": { weapon: "claw", motion: "stomp", idleFrameMs: 240, flying: false, cell: 96 },
  "plant-hydra": { weapon: "fang", motion: "shoot", idleFrameMs: 220, flying: false, cell: 64 },
  "dragon-boss": { weapon: "breath", motion: "breath", idleFrameMs: 200, flying: false, cell: 96 },
  "caster-wraith": { weapon: "staff", motion: "float", idleFrameMs: 200, flying: true, cell: 64 },
};

export interface MonsterPixelRecipe {
  readonly name?: string;
  readonly archetype?: MonsterArchetype;
  /** #rrggbb — 몸통. */
  readonly primaryColor?: string;
  /** #rrggbb — 갑옷·배·잎 같은 둘째 재질. */
  readonly secondaryColor?: string;
  /** #rrggbb — 가시·수정·눈빛·스킬 빛. */
  readonly accentColor?: string;
  readonly weapon?: MonsterWeapon;
  readonly cell?: MonsterSheetCell;
  readonly motion?: PixelEnemyMotion;
  /** 등·어깨 수정 가시. */
  readonly spikes?: boolean;
  /** 머리 뿔. */
  readonly horns?: boolean;
  /**
   * 모드 B: 칸별 문자 격자(위→아래 줄). 문자 = MONSTER_PIXEL_CHARS 의 키.
   * cell×cell 이면 그 자리에, 더 작으면 가로 가운데·아래쪽 기준선(y=cell−4)에 맞춰 찍는다.
   */
  readonly cells?: Partial<Record<PixelEnemyCell, readonly string[]>>;
}

/** 모드 B 격자 문자 → 팔레트 칸. '.' 투명. */
export const MONSTER_PIXEL_CHARS: Readonly<Record<string, string>> = {
  ".": "투명", o: "외곽선",
  "1": "주색 그늘", "2": "주색", "3": "주색 빛",
  "4": "보조색 그늘", "5": "보조색", "6": "보조색 빛",
  "7": "강조색 그늘", "8": "강조색", "9": "강조색 빛",
  w: "흰색(이빨·눈 흰자)", m: "금속 그늘", n: "금속", q: "금속 빛", e: "눈빛",
};
const CHAR_INDEX: Readonly<Record<string, number>> = {
  ".": 0, o: 1, "1": 2, "2": 3, "3": 4, "4": 5, "5": 6, "6": 7, "7": 8, "8": 9, "9": 10, w: 11, m: 12, n: 13, q: 14, e: 15,
};
const INDEX_CHAR = Object.keys(CHAR_INDEX);

export interface MonsterCellBounds { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly bottom: number }

export interface MonsterPixelSheet {
  readonly name: string;
  readonly archetype: MonsterArchetype | "custom";
  readonly weapon: MonsterWeapon;
  readonly cell: MonsterSheetCell;
  readonly motion: PixelEnemyMotion;
  readonly idleFrameMs: number;
  readonly flying: boolean;
  /** 3×3 시트 PNG data URL. */
  readonly sheetDataUrl: string;
  /** 대기 a 한 칸 PNG data URL(목록·히어로·일반 전투 스킨용 초상). */
  readonly portraitDataUrl: string;
  readonly bounds: Readonly<Record<PixelEnemyCell, MonsterCellBounds>>;
  /** 쓴 색(투명 제외) 수. 계약 상한 16. */
  readonly colors: number;
  /** 가장 비슷한 두 칸의 다른 픽셀 수 — 0 이면 같은 그림이 두 칸에 있다. */
  readonly minPairDiff: { readonly pixels: number; readonly cells: readonly [PixelEnemyCell, PixelEnemyCell] };
  /** 팔레트 문자 → #rrggbb(모드 B 격자를 쓸 때 참고). */
  readonly palette: Readonly<Record<string, string>>;
  /** 계약 위반(경계·기준선·빈 칸·같은 칸). 비어 있어야 정상. */
  readonly errors: readonly string[];
  /** 칸별 문자 격자(모드 B 로 고쳐 다시 넣을 수 있다). */
  readonly rows: Readonly<Record<PixelEnemyCell, readonly string[]>>;
}

export class MonsterPixelRecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonsterPixelRecipeError";
  }
}

// ---------------------------------------------------------------- 색

type Rgb = readonly [number, number, number];

function parseHex(value: string | undefined, fallback: string): Rgb {
  const text = (value ?? fallback).trim();
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(text);
  if (!match) throw new MonsterPixelRecipeError(`색은 #rrggbb 로 주세요: ${JSON.stringify(value)}`);
  const hex = match[1]!.length === 3 ? match[1]!.replace(/./g, (c) => c + c) : match[1]!;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const clamp = (v: number): number => Math.max(0, Math.min(1, v));
  s = clamp(s); l = clamp(l);
  if (s === 0) return [Math.round(l * 255), Math.round(l * 255), Math.round(l * 255)];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    t = ((t % 1) + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255);
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/** 한 색에서 그늘·바탕·빛 3단(셀 음영). 그늘은 색상을 살짝 차갑게 돌린다. */
function ramp(base: Rgb): [Rgb, Rgb, Rgb] {
  const [h, s, l] = rgbToHsl(base);
  return [
    hslToRgb(h + 0.02, s * 0.95 + 0.05, l * 0.62),
    base,
    hslToRgb(h - 0.015, s * 0.9, Math.min(0.94, l * 1.18 + 0.12)),
  ];
}

function buildPalette(recipe: MonsterPixelRecipe): Rgb[] {
  const primary = parseHex(recipe.primaryColor, "#5a6f8f");
  const secondary = parseHex(recipe.secondaryColor, "#c9b27c");
  const accent = parseHex(recipe.accentColor, "#b15cff");
  const [ph, ps] = rgbToHsl(primary);
  const [ah, as] = rgbToHsl(accent);
  return [
    [0, 0, 0],
    hslToRgb(ph, Math.min(0.55, ps * 0.6 + 0.1), 0.1),
    ...ramp(primary),
    ...ramp(secondary),
    ...ramp(accent),
    [244, 240, 228],
    [70, 76, 92], [138, 146, 164], [214, 220, 232],
    hslToRgb(ah, Math.max(0.6, as), 0.78),
  ];
}

function hexOf([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------- 격자·마스크

const O = 1, W = 11;
type Tone = "p" | "s" | "a" | "m";
const TONES: Readonly<Record<Tone, readonly [number, number, number]>> = { p: [2, 3, 4], s: [5, 6, 7], a: [8, 9, 10], m: [12, 13, 14] };
type Pt = readonly [number, number];

class Grid {
  readonly px: Uint8Array;
  constructor(readonly size: number) {
    this.px = new Uint8Array(size * size);
  }

  get(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.size || y >= this.size ? 0 : this.px[y * this.size + x]!;
  }

  set(x: number, y: number, c: number): void {
    if (x >= 0 && y >= 0 && x < this.size && y < this.size) this.px[y * this.size + x] = c;
  }

  clone(): Grid {
    const copy = new Grid(this.size);
    copy.px.set(this.px);
    return copy;
  }
}

class Mask {
  readonly on: Uint8Array;
  constructor(readonly size: number) {
    this.on = new Uint8Array(size * size);
  }

  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size && this.on[y * this.size + x] === 1;
  }

  add(x: number, y: number): void {
    if (x >= 0 && y >= 0 && x < this.size && y < this.size) this.on[y * this.size + x] = 1;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number): this {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y += 1) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x += 1) {
        const dx = (x + 0.5 - cx) / Math.max(0.5, rx), dy = (y + 0.5 - cy) / Math.max(0.5, ry);
        if (dx * dx + dy * dy <= 1) this.add(x, y);
      }
    }
    return this;
  }

  poly(points: readonly Pt[]): this {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i += 1) {
        const [ax, ay] = points[i]!, [bx, by] = points[(i + 1) % points.length]!;
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]! - 0.5); x <= Math.floor(xs[k + 1]! - 0.5); x += 1) this.add(x, y);
      }
    }
    return this;
  }

  /** 둥근 끝 굵은 획(점 사이를 원판으로 찍는다). */
  stroke(points: readonly Pt[], width: number): this {
    const r = Math.max(0.5, width / 2);
    const disc = (cx: number, cy: number): void => {
      if (width <= 1.2) { this.add(Math.round(cx - 0.5), Math.round(cy - 0.5)); return; }
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= r * r) this.add(x, y);
        }
      }
    };
    if (points.length === 1) disc(points[0]![0], points[0]![1]);
    for (let i = 0; i + 1 < points.length; i += 1) {
      const [ax, ay] = points[i]!, [bx, by] = points[i + 1]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (let k = 0; k <= steps; k += 1) disc(ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps);
    }
    return this;
  }
}

interface PaintOptions {
  /** false 면 외곽선을 두르지 않는다(부위 안의 무늬). */
  readonly outline?: boolean;
  /** 음영 없이 바탕색 한 가지. */
  readonly flat?: boolean;
  /** 셀 음영 대신 이 색 번호 하나. */
  readonly color?: number;
}

/** 마스크 하나를 외곽선 + 3단 셀 음영(빛: 왼쪽 위)으로 칠한다. */
function paint(grid: Grid, mask: Mask, tone: Tone, options: PaintOptions = {}): void {
  const size = grid.size;
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    if (!mask.has(x, y)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (maxX < 0) return;
  if (options.outline !== false) {
    for (let y = minY - 1; y <= maxY + 1; y += 1) for (let x = minX - 1; x <= maxX + 1; x += 1) {
      if (!mask.has(x, y) && (mask.has(x - 1, y) || mask.has(x + 1, y) || mask.has(x, y - 1) || mask.has(x, y + 1))) grid.set(x, y, O);
    }
  }
  const [dark, base, lit] = TONES[tone];
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const hw = Math.max(1, (maxX - minX) / 2), hh = Math.max(1, (maxY - minY) / 2);
  for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
    if (!mask.has(x, y)) continue;
    if (options.color !== undefined) { grid.set(x, y, options.color); continue; }
    if (options.flat) { grid.set(x, y, base); continue; }
    const t = ((x - cx) / hw) * 0.45 + ((y - cy) / hh) * 0.9;
    const lowerRim = !mask.has(x, y + 1) || !mask.has(x + 1, y + 1);
    const upperRim = !mask.has(x, y - 1) || !mask.has(x - 1, y) || (!mask.has(x, y - 2) && hh > 4);
    grid.set(x, y, t > 0.42 || (lowerRim && t > -0.2) ? dark : upperRim && t < 0.1 ? lit : base);
  }
}

function put(grid: Grid, x: number, y: number, rows: readonly string[]): void {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== ".") grid.set(Math.round(x) + i, Math.round(y) + j, CHAR_INDEX[ch] ?? O);
  }));
}

// ---------------------------------------------------------------- 자세 표

interface Pose {
  /** 숨쉬기 내려앉음(px 단위, 64 기준). */
  readonly bob: number;
  /** 몸 기울기(+ 앞으로). */
  readonly lean: number;
  /** 무릎 굽힘. */
  readonly crouch: number;
  /** 다리 벌림(0 서기 … 1 크게 내딛기). */
  readonly stride: number;
  /** 무기 팔: idle 0, windup 1(뒤로 치켜듦), attack 2(앞으로 내리침), skill 3(위로 치켜듦), hit 4. */
  readonly arm: 0 | 1 | 2 | 3 | 4;
  /** 입 벌림 0..1. */
  readonly mouth: number;
  /** 날갯짓 -1 위 … 1 아래. */
  readonly flap: number;
  /** 머리 높이 보정(+ 위). */
  readonly head: number;
  readonly skill: boolean;
  readonly hurt: boolean;
}

const POSES: Readonly<Record<Exclude<PixelEnemyCell, "dead">, Pose>> = {
  idle_a: { bob: 0, lean: 0, crouch: 0, stride: 0, arm: 0, mouth: 0, flap: -0.6, head: 0, skill: false, hurt: false },
  idle_b: { bob: 1, lean: 0, crouch: 0.5, stride: 0, arm: 0, mouth: 0, flap: 0.2, head: -0.5, skill: false, hurt: false },
  idle_c: { bob: 2, lean: 0.5, crouch: 1, stride: 0, arm: 0, mouth: 0.2, flap: 0.9, head: -1, skill: false, hurt: false },
  windup: { bob: 1, lean: -3, crouch: 3, stride: 0.3, arm: 1, mouth: 0.3, flap: -1, head: -2, skill: false, hurt: false },
  move: { bob: 0, lean: 4, crouch: 1, stride: 1, arm: 0, mouth: 0.4, flap: 0.6, head: 0, skill: false, hurt: false },
  attack: { bob: 1, lean: 7, crouch: 2, stride: 0.8, arm: 2, mouth: 1, flap: 1, head: 1, skill: false, hurt: false },
  recover: { bob: 0, lean: -1, crouch: 0, stride: 0.2, arm: 3, mouth: 1, flap: -1, head: 4, skill: true, hurt: false },
  hit: { bob: 2, lean: -5, crouch: 2, stride: 0.3, arm: 4, mouth: 0.6, flap: 0.4, head: -2, skill: false, hurt: true },
};

interface Rig {
  readonly grid: Grid;
  readonly u: number;
  readonly cx: number;
  readonly ground: number;
  readonly weapon: MonsterWeapon;
  readonly spikes: boolean;
  readonly horns: boolean;
  /** 64 기준 좌표(x 오른쪽 +, h 바닥 위 높이) → 칸 픽셀. */
  readonly at: (x: number, h: number) => Pt;
  readonly mask: () => Mask;
}

function makeRig(cell: number, recipe: MonsterPixelRecipe, weapon: MonsterWeapon, archetype: MonsterArchetype, scale: number): Rig {
  const grid = new Grid(cell);
  const u = (cell / 64) * scale;
  const cx = cell / 2;
  const ground = cell - 4;
  return {
    grid, u, cx, ground, weapon,
    spikes: recipe.spikes ?? (archetype === "beast" || archetype === "golem-construct"),
    horns: recipe.horns ?? (archetype === "winged-fiend" || archetype === "dragon-boss"),
    at: (x, h) => [cx + x * u, ground + 1 - h * u],
    mask: () => new Mask(cell),
  };
}

// ---------------------------------------------------------------- 공용 부품

function ik(a: Pt, t: Pt, l1: number, l2: number, bend: 1 | -1): Pt {
  const dx = t[0] - a[0], dy = t[1] - a[1];
  const d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy) || 0.001));
  const base = Math.atan2(dy, dx);
  const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const angle = base + bend * Math.acos(Math.max(-1, Math.min(1, c)));
  return [a[0] + l1 * Math.cos(angle), a[1] + l1 * Math.sin(angle)];
}

/** 두 마디 다리(무릎 IK) + 발. 발바닥 외곽선이 기준선에 닿는다. */
function leg(r: Rig, hip: Pt, footX: number, footLift: number, width: number, tone: Tone, toeForward = true): void {
  const sole = r.at(footX, footLift);
  const ankle: Pt = [sole[0], sole[1] - Math.max(2, width / 2 + 1) * 1];
  const length = Math.hypot(ankle[0] - hip[0], ankle[1] - hip[1]);
  const knee = ik(hip, ankle, length * 0.56 + 1.5 * r.u, length * 0.56 + 1.5 * r.u, toeForward ? -1 : 1);
  paint(r.grid, r.mask().stroke([hip, knee, ankle], width), tone);
  const fw = Math.max(3, width * 0.9), fh = Math.max(2, width * 0.55);
  const dir = toeForward ? 1 : -1;
  paint(r.grid, r.mask().poly([
    [ankle[0] - fw * 0.5 * dir, sole[1] - fh - 1], [ankle[0] + fw * 0.5 * dir, sole[1] - fh - 1],
    [ankle[0] + (fw * 0.5 + 2 * r.u) * dir, sole[1] - 1], [ankle[0] - fw * 0.5 * dir, sole[1] - 1],
  ]), tone === "p" ? "s" : tone);
}

function eye(r: Rig, p: Pt, hurt: boolean, big = false): void {
  const [x, y] = [Math.round(p[0]), Math.round(p[1])];
  if (hurt) { put(r.grid, x - 1, y, ["o.o", ".o.", "o.o"].slice(0, big ? 3 : 2)); return; }
  if (big || r.u >= 1.4) put(r.grid, x - 1, y - 1, ["ow", "ee", "ee"]);
  else put(r.grid, x, y, ["e", "e"]);
}

/** 수정 가시 한 개(밑변 a-b, 끝 tip). */
function spike(r: Rig, a: Pt, b: Pt, tip: Pt): void {
  paint(r.grid, r.mask().poly([a, tip, b]), "a");
}

function horn(r: Rig, base: Pt, tip: Pt, width: number): void {
  paint(r.grid, r.mask().stroke([base, [(base[0] + tip[0]) / 2 - width * 0.3, (base[1] + tip[1]) / 2], tip], width), "s");
}

/** 4갈래 반짝임(스킬 빛). */
function sparkle(r: Rig, p: Pt, size: number): void {
  const [x, y] = [Math.round(p[0]), Math.round(p[1])];
  for (let k = -size; k <= size; k += 1) {
    r.grid.set(x + k, y, Math.abs(k) <= size / 2 ? 10 : 9);
    r.grid.set(x, y + k, Math.abs(k) <= size / 2 ? 10 : 9);
  }
  r.grid.set(x, y, W);
}

function skillAura(r: Rig, center: Pt, radius: number): void {
  const n = 6;
  for (let i = 0; i < n; i += 1) {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2 + 0.3;
    const p: Pt = [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius * 0.8];
    sparkle(r, p, Math.max(1, Math.round((i % 2 ? 1.5 : 2.5) * r.u)));
  }
}

/** 타격 순간 흰 별(피격 칸). */
function impact(r: Rig, p: Pt): void {
  const s = Math.max(2, Math.round(2.5 * r.u));
  const [x, y] = [Math.round(p[0]), Math.round(p[1])];
  for (let k = -s; k <= s; k += 1) { r.grid.set(x + k, y + k, W); r.grid.set(x + k, y - k, W); }
}

/** 입에서 앞으로 퍼지는 숨결(불꽃·독·냉기 — 강조색). */
function breath(r: Rig, mouth: Pt, length: number, spread: number): void {
  const end = Math.min(r.grid.size - 2, mouth[0] + length);
  const len = end - mouth[0];
  if (len < 3) return;
  paint(r.grid, r.mask().poly([[mouth[0], mouth[1] - 1], [end, mouth[1] - spread], [end - 1, mouth[1] + spread], [mouth[0], mouth[1] + 1]]), "a", { outline: false });
  paint(r.grid, r.mask().poly([[mouth[0], mouth[1]], [end - len * 0.25, mouth[1] - spread * 0.45], [end - len * 0.2, mouth[1] + spread * 0.45]]), "a", { outline: false, color: 10 });
  r.grid.set(Math.round(mouth[0] + 1), Math.round(mouth[1]), W);
}

/** 손에 든 무기. angle 은 라디안(0 = 오른쪽, -π/2 = 위). */
function heldWeapon(r: Rig, hand: Pt, angle: number, weapon: MonsterWeapon, glow: boolean): void {
  const u = r.u;
  const dir: Pt = [Math.cos(angle), Math.sin(angle)];
  const along = (d: number): Pt => [hand[0] + dir[0] * d * u, hand[1] + dir[1] * d * u];
  const side: Pt = [-dir[1], dir[0]];
  if (weapon === "staff") {
    paint(r.grid, r.mask().stroke([along(-6), along(18)], Math.max(2, 2 * u)), "s", { flat: true });
    const orb = along(20);
    paint(r.grid, r.mask().ellipse(orb[0], orb[1], 3.2 * u, 3.2 * u), "a");
    if (glow) skillAura(r, orb, 7 * u);
    return;
  }
  if (weapon === "spear") {
    paint(r.grid, r.mask().stroke([along(-8), along(18)], Math.max(2, 1.8 * u)), "s", { flat: true });
    const tip = along(26), b1 = along(18);
    paint(r.grid, r.mask().poly([[b1[0] + side[0] * 3 * u, b1[1] + side[1] * 3 * u], tip, [b1[0] - side[0] * 3 * u, b1[1] - side[1] * 3 * u]]), "m");
    return;
  }
  if (weapon === "axe") {
    paint(r.grid, r.mask().stroke([along(-3), along(16)], Math.max(2, 2 * u)), "s", { flat: true });
    const h0 = along(11), h1 = along(17);
    const out = (p: Pt, k: number): Pt => [p[0] + side[0] * k * u, p[1] + side[1] * k * u];
    paint(r.grid, r.mask().poly([out(h0, -1), out(h0, -6), out(along(14), -8), out(h1, -6), out(h1, -1)]), "m");
    return;
  }
  // sword (그 밖에 손에 들 수 없는 무기도 검으로)
  const guardA: Pt = [hand[0] + (dir[0] * 2.5 + side[0] * 4) * u, hand[1] + (dir[1] * 2.5 + side[1] * 4) * u];
  const guardB: Pt = [hand[0] + (dir[0] * 2.5 - side[0] * 4) * u, hand[1] + (dir[1] * 2.5 - side[1] * 4) * u];
  paint(r.grid, r.mask().stroke([along(3), along(19)], Math.max(2.4, 3 * u)), "m");
  paint(r.grid, r.mask().stroke([guardA, guardB], Math.max(1.6, 1.8 * u)), "a", { flat: true });
  paint(r.grid, r.mask().stroke([along(-3), along(1)], Math.max(1.6, 1.8 * u)), "s", { flat: true });
  if (glow) skillAura(r, along(14), 7 * u);
}

// ---------------------------------------------------------------- 원형 리그

type Draw = (r: Rig, pose: Pose) => void;

const drawBeast: Draw = (r, pose) => {
  const { u } = r;
  const bodyH = 17 - pose.crouch - pose.bob * 0.5;
  const shift = pose.lean * 0.5;
  const stride = pose.stride;
  const tailWave = pose.flap * 2;
  // 꼬리
  paint(r.grid, r.mask().stroke([r.at(-14 + shift, bodyH + 2), r.at(-21 + shift, bodyH + 6 + tailWave), r.at(-25 + shift, bodyH + 12 + tailWave)], 4 * u), "p");
  // 먼 다리(그늘색)
  leg(r, r.at(-11 + shift, bodyH - 2), -15 - stride * 5, 0, 3.6 * u, "p", true);
  leg(r, r.at(8 + shift, bodyH - 2), 7 + stride * 7 + Math.max(0, pose.lean) * 0.3, pose.stride > 0.9 ? 2 : 0, 3.6 * u, "p", true);
  // 몸통
  paint(r.grid, r.mask().ellipse(...r.at(-2 + shift, bodyH + 3), 15 * u, 8 * u), "p");
  paint(r.grid, r.mask().ellipse(...r.at(1 + shift, bodyH + 0.5), 10 * u, 4 * u), "s", { outline: false });
  if (r.spikes) {
    for (const [x, tall] of [[-11, 6], [-5, 8], [1, 7], [6, 5]] as const) {
      const base = bodyH + 9.5 - Math.abs(x + 2) * 0.12;
      spike(r, r.at(x - 2.4 + shift, base), r.at(x + 2.4 + shift, base), r.at(x - 1 + shift, base + tall + (pose.skill ? 3 : 0)));
    }
  }
  // 가까운 다리
  leg(r, r.at(-8 + shift, bodyH - 1), -10 + stride * 6, 0, 4.2 * u, "p", true);
  leg(r, r.at(10 + shift, bodyH - 1), 13 + stride * 3 + Math.max(0, pose.lean) * 0.6, 0, 4.2 * u, "p", true);
  // 머리
  const howl = pose.skill ? 6 : 0;
  const hx = 17 + shift + pose.lean * 0.6;
  const hh = bodyH + 8 + pose.head + howl;
  paint(r.grid, r.mask().stroke([r.at(8 + shift, bodyH + 5), r.at(hx - 2, hh - 1)], 7 * u), "p");
  paint(r.grid, r.mask().poly([r.at(hx - 4, hh + 3), r.at(hx - 2.5, hh + 10), r.at(hx + 0.5, hh + 3)]), "p");
  paint(r.grid, r.mask().ellipse(...r.at(hx, hh), 6.5 * u, 5.5 * u), "p");
  const jaw = pose.mouth * (pose.skill ? 4 : 3);
  const snoutTip = r.at(hx + 10, hh - 1 + howl * 0.4);
  paint(r.grid, r.mask().poly([r.at(hx + 2, hh + 2.5), snoutTip, [snoutTip[0], snoutTip[1] + 3 * u], r.at(hx + 3, hh - 2.5)]), "p");
  paint(r.grid, r.mask().poly([r.at(hx + 1, hh - 2.5), r.at(hx + 8, hh - 3.5 - jaw), r.at(hx + 7, hh - 5.5 - jaw), r.at(hx, hh - 4.5)]), "s");
  if (pose.mouth > 0.3 || r.weapon === "fang") {
    const top = r.at(hx + 7, hh - 2);
    r.grid.set(Math.round(top[0]), Math.round(top[1]), W);
    r.grid.set(Math.round(top[0] - 2 * u), Math.round(top[1]), W);
  }
  r.grid.set(Math.round(snoutTip[0]), Math.round(snoutTip[1]), O);
  eye(r, r.at(hx + 2, hh + 2), pose.hurt);
  if (r.weapon === "claw") {
    const paw = r.at(15 + stride * 3 + Math.max(0, pose.lean) * 0.6, 1);
    put(r.grid, paw[0] + 1, paw[1] - 1, ["w.w"]);
  }
  if (r.weapon === "breath" && pose.arm === 2) breath(r, r.at(hx + 10, hh - 2), 16 * u, 4 * u);
  if (pose.skill) skillAura(r, r.at(hx, hh + 6), 9 * u);
  if (pose.hurt) impact(r, r.at(hx + 8, hh + 4));
};

const drawKnight: Draw = (r, pose) => {
  const { u } = r;
  const hipH = 19 - pose.crouch * 1.2 - pose.bob * 0.5;
  const hipX = pose.lean * 0.45;
  const shoulderH = hipH + 13 - pose.bob * 0.3;
  const shoulderX = hipX + pose.lean * 0.7;
  const st = pose.stride;
  // 뒷다리·앞다리
  leg(r, r.at(hipX - 2.5, hipH), -6 - st * 6, 0, 4.4 * u, "s");
  // 방패 팔(뒤)
  const shieldHand = r.at(shoulderX - 5 + (pose.arm === 4 ? -2 : 0), shoulderH - 9 + (pose.arm === 3 ? 4 : 0));
  paint(r.grid, r.mask().stroke([r.at(shoulderX - 4, shoulderH - 1), shieldHand], 3.6 * u), "s");
  // 몸통(갑옷)
  paint(r.grid, r.mask().poly([
    r.at(hipX - 5.5, hipH + 1), r.at(hipX + 5.5, hipH + 1),
    r.at(shoulderX + 7.5, shoulderH), r.at(shoulderX + 5, shoulderH + 2.5), r.at(shoulderX - 5, shoulderH + 2.5), r.at(shoulderX - 7.5, shoulderH),
  ]), "p");
  paint(r.grid, r.mask().stroke([r.at(hipX - 5, hipH + 2), r.at(hipX + 5, hipH + 2)], 2.2 * u), "s", { flat: true, outline: false });
  if (r.spikes) {
    spike(r, r.at(shoulderX - 7, shoulderH + 1), r.at(shoulderX - 3, shoulderH + 2), r.at(shoulderX - 8, shoulderH + 7));
  }
  leg(r, r.at(hipX + 2.5, hipH), 6 + st * 7 + Math.max(0, pose.lean) * 0.4, 0, 4.8 * u, "s");
  // 방패
  const sh = shieldHand;
  paint(r.grid, r.mask().poly([[sh[0] - 4 * u, sh[1] - 6 * u], [sh[0] + 3 * u, sh[1] - 6 * u], [sh[0] + 3 * u, sh[1] + 2 * u], [sh[0] - 0.5 * u, sh[1] + 6 * u], [sh[0] - 4 * u, sh[1] + 2 * u]]), "s");
  paint(r.grid, r.mask().stroke([[sh[0] - 0.5 * u, sh[1] - 3.5 * u], [sh[0] - 0.5 * u, sh[1] + 2.5 * u]], Math.max(1.2, 1.6 * u)), "a", { flat: true, outline: false });
  // 머리(투구)
  const headC = r.at(shoulderX + 1 + pose.lean * 0.2, shoulderH + 7 + pose.head * 0.4);
  paint(r.grid, r.mask().ellipse(headC[0], headC[1], 5.5 * u, 6 * u), "m");
  paint(r.grid, r.mask().stroke([[headC[0] - 5 * u, headC[1] - 5.5 * u], [headC[0] - 9 * u, headC[1] - 9 * u + pose.flap * u]], 2.6 * u), "a", { flat: true });
  if (r.horns) horn(r, [headC[0] - 2 * u, headC[1] - 5 * u], [headC[0] - 6 * u, headC[1] - 11 * u], 2.2 * u);
  put(r.grid, headC[0] + 1 * u, headC[1] - 0.5 * u, pose.hurt ? ["oo.o"] : ["oeeo"].map((row) => (u >= 1.4 ? row + "e" : row)));
  // 무기 팔(앞)
  const armSh = r.at(shoulderX + 3, shoulderH);
  const handTargets: Record<Pose["arm"], readonly [number, number, number]> = {
    0: [shoulderX + 9, shoulderH - 8, -Math.PI / 3],
    1: [shoulderX - 3, shoulderH + 7, -Math.PI * 0.8],
    2: [shoulderX + 13, shoulderH - 3, Math.PI * 0.05],
    3: [shoulderX + 6, shoulderH + 9, -Math.PI / 2],
    4: [shoulderX + 3, shoulderH - 9, -Math.PI * 0.62],
  };
  const [hxw, hhw, angle] = handTargets[pose.arm];
  const hand = r.at(hxw, hhw);
  const elbow = ik(armSh, hand, 6 * u, 6 * u, pose.arm === 1 || pose.arm === 3 ? -1 : 1);
  if (r.weapon === "claw") {
    paint(r.grid, r.mask().stroke([armSh, elbow, hand], 3.6 * u), "p");
    put(r.grid, hand[0] + 1, hand[1] - 1, ["ww", ".w", "w."]);
  } else {
    heldWeapon(r, hand, angle, r.weapon, pose.skill);
    paint(r.grid, r.mask().stroke([armSh, elbow, hand], 3.6 * u), "p");
    paint(r.grid, r.mask().ellipse(hand[0], hand[1], 2 * u, 2 * u), "s");
  }
  if (r.weapon === "breath" && pose.arm === 2) breath(r, [headC[0] + 5 * u, headC[1] + 1 * u], 14 * u, 4 * u);
  if (pose.skill && r.weapon !== "staff" && r.weapon !== "sword") skillAura(r, r.at(shoulderX, shoulderH + 4), 13 * u);
  if (pose.hurt) impact(r, r.at(shoulderX + 9, shoulderH + 2));
};

const drawFiend: Draw = (r, pose) => {
  const { u } = r;
  const hover = 22 + pose.bob * -0.7 + (pose.arm === 2 ? -4 : 0) + (pose.skill ? 3 : 0) + (pose.hurt ? 2 : 0);
  const bx = pose.lean * 0.7;
  const shoulder = r.at(bx - 1, hover + 9);
  // 날개: flap -1 위, 1 아래
  const wingTip = (far: boolean): Pt => r.at(bx - (far ? 14 : 20) - (pose.skill ? 4 : 0), hover + 9 - pose.flap * 14 + (far ? 2 : 0));
  const wing = (far: boolean): void => {
    const tip = wingTip(far);
    const mid = r.at(bx - (far ? 9 : 13), hover + 4 - pose.flap * 6);
    paint(r.grid, r.mask().poly([shoulder, tip, [tip[0] + 2 * u, tip[1] + 6 * u], mid, r.at(bx - 3, hover + 3)]), far ? "s" : "p");
    paint(r.grid, r.mask().stroke([shoulder, tip], Math.max(1.4, 1.6 * u)), "p", { flat: true, outline: false });
  };
  wing(true);
  // 꼬리
  paint(r.grid, r.mask().stroke([r.at(bx - 4, hover), r.at(bx - 9, hover - 5), r.at(bx - 14, hover - 3 + pose.flap * 2)], 2.4 * u), "p");
  // 다리(움츠림·공격 때 뻗음)
  const reach = pose.arm === 2 ? 7 : 2;
  paint(r.grid, r.mask().stroke([r.at(bx - 1, hover), r.at(bx + reach * 0.5, hover - 5), r.at(bx + reach, hover - 8)], 3 * u), "p");
  const claw = r.at(bx + reach, hover - 8);
  put(r.grid, claw[0], claw[1], ["w.w", ".w."]);
  // 몸통·머리
  paint(r.grid, r.mask().ellipse(...r.at(bx, hover + 5), 6 * u, 7.5 * u), "p");
  paint(r.grid, r.mask().ellipse(...r.at(bx + 1.5, hover + 4), 3 * u, 4.5 * u), "s", { outline: false });
  const head = r.at(bx + 3 + pose.lean * 0.2, hover + 15 + pose.head * 0.5);
  paint(r.grid, r.mask().ellipse(head[0], head[1], 5 * u, 4.5 * u), "p");
  if (r.horns) {
    horn(r, [head[0] - 1 * u, head[1] - 3.5 * u], [head[0] - 5 * u, head[1] - 10 * u], 2 * u);
    horn(r, [head[0] + 2.5 * u, head[1] - 3.5 * u], [head[0] + 3 * u, head[1] - 9 * u], 1.8 * u);
  }
  if (r.spikes) spike(r, r.at(bx - 4, hover + 9), r.at(bx - 1, hover + 11), r.at(bx - 6, hover + 15));
  eye(r, [head[0] + 2 * u, head[1] - 1 * u], pose.hurt);
  if (pose.mouth > 0.5) put(r.grid, head[0] + 2 * u, head[1] + 2 * u, ["ow", "wo"]);
  wing(false);
  if (r.weapon === "breath" && pose.arm === 2) breath(r, [head[0] + 5 * u, head[1] + 1 * u], 14 * u, 4 * u);
  if (pose.skill) skillAura(r, r.at(bx, hover + 8), 15 * u);
  if (pose.hurt) impact(r, r.at(bx + 9, hover + 10));
};

const drawSlime: Draw = (r, pose) => {
  const { u } = r;
  const squash = [0, 1.2, 2.2, 3.4, -3, 1, -2, 2.6][["idle_a", "idle_b", "idle_c", "windup", "move", "attack", "recover", "hit"].indexOf(poseName(pose))] ?? 0;
  const lift = pose.stride >= 1 ? 6 : 0;
  const rx = 15 + squash * 1.1 + (pose.arm === 2 ? 3 : 0);
  const ry = 12.5 - squash;
  const lean = pose.lean * 0.6;
  const c = r.at(lean, lift + ry);
  const m = r.mask().ellipse(c[0], c[1], rx * u, ry * u);
  // 바닥은 납작하게 자른다(기준선 아래 칸을 지운다).
  const floorY = r.ground - lift * u;
  for (let y = Math.ceil(floorY + 1); y < r.grid.size; y += 1) for (let x = 0; x < r.grid.size; x += 1) m.on[y * r.grid.size + x] = 0;
  if (pose.arm === 2) m.ellipse(...r.at(lean + rx - 3, lift + 5), 6 * u, 4.5 * u);
  if (pose.skill) for (const x of [-7, 0, 7]) m.poly([r.at(lean + x - 3, lift + ry * 1.7), r.at(lean + x + 3, lift + ry * 1.7), r.at(lean + x, lift + ry * 2 + 6)]);
  paint(r.grid, m, "p");
  paint(r.grid, r.mask().ellipse(...r.at(lean - 2, lift + ry + 1), 5 * u, 4 * u), "a", { outline: false });
  r.grid.set(Math.round(c[0] - rx * 0.45 * u), Math.round(c[1] - ry * 0.55 * u), W);
  r.grid.set(Math.round(c[0] - rx * 0.45 * u) + 1, Math.round(c[1] - ry * 0.55 * u), W);
  eye(r, r.at(lean + 4, lift + ry + 2), pose.hurt);
  eye(r, r.at(lean + 9, lift + ry + 1.5), pose.hurt);
  if (pose.mouth > 0.5) put(r.grid, r.at(lean + 5, lift + ry - 2)[0], r.at(lean + 5, lift + ry - 2)[1], ["owwo", ".oo."]);
  if (r.weapon === "breath" && pose.arm === 2) breath(r, r.at(lean + rx + 2, lift + 5), 10 * u, 3 * u);
  if (pose.skill) skillAura(r, r.at(lean, lift + ry + 4), 16 * u);
  if (pose.hurt) impact(r, r.at(lean + rx - 1, lift + ry + 4));
};

const drawGolem: Draw = (r, pose) => {
  const { u } = r;
  const hipH = 15 - pose.crouch - pose.bob * 0.5;
  const bx = pose.lean * 0.5;
  const st = pose.stride;
  const pillar = (x: number, footX: number, tone: Tone): void => {
    const hip = r.at(bx + x, hipH);
    const foot = r.at(footX, 0);
    paint(r.grid, r.mask().poly([[hip[0] - 4 * u, hip[1]], [hip[0] + 4 * u, hip[1]], [foot[0] + 5 * u, foot[1] - 1], [foot[0] - 5 * u, foot[1] - 1]]), tone);
  };
  pillar(-6, -8 - st * 5, "s");
  // 뒤 팔
  const backFist = r.at(bx - 15 + (pose.arm === 1 ? -2 : 0), hipH + (pose.arm === 1 || pose.arm === 3 ? 26 : 4));
  paint(r.grid, r.mask().stroke([r.at(bx - 11, hipH + 19), backFist], 6 * u), "s");
  paint(r.grid, r.mask().ellipse(backFist[0], backFist[1], 4.5 * u, 4.5 * u), "s");
  // 몸통 돌덩이
  const top = hipH + 24;
  paint(r.grid, r.mask().poly([r.at(bx - 11, hipH), r.at(bx + 11, hipH), r.at(bx + 14, top - 4), r.at(bx + 10, top), r.at(bx - 10, top), r.at(bx - 14, top - 4)]), "p");
  paint(r.grid, r.mask().stroke([r.at(bx - 6, hipH + 8), r.at(bx + 2, hipH + 12), r.at(bx + 8, hipH + 9)], Math.max(1, u)), "p", { color: 2, outline: false });
  const core = r.at(bx + 1, hipH + 15);
  paint(r.grid, r.mask().ellipse(core[0], core[1], 3 * u, 3 * u), "a", pose.skill ? { color: 10 } : {});
  if (r.spikes) {
    spike(r, r.at(bx - 12, top - 3), r.at(bx - 6, top), r.at(bx - 13, top + 7));
    spike(r, r.at(bx + 5, top), r.at(bx + 11, top - 2), r.at(bx + 10, top + 6));
  }
  // 머리
  const head = r.at(bx + 4 + pose.lean * 0.3, top + 4 + pose.head * 0.3);
  paint(r.grid, r.mask().poly([[head[0] - 5 * u, head[1] + 3 * u], [head[0] + 6 * u, head[1] + 3 * u], [head[0] + 5 * u, head[1] - 4 * u], [head[0] - 4 * u, head[1] - 4 * u]]), "p");
  put(r.grid, head[0], head[1] - 0.5 * u, pose.hurt ? ["oo.oo"] : [u >= 1.4 ? "eeeee" : "eeee"]);
  pillar(6, 8 + st * 6 + Math.max(0, pose.lean) * 0.3, "s");
  // 앞 팔 + 주먹
  const fistTarget: Record<Pose["arm"], Pt> = {
    0: r.at(bx + 15, hipH + 2), 1: r.at(bx + 4, top + 12), 2: r.at(bx + 22, hipH - 2), 3: r.at(bx + 12, top + 14), 4: r.at(bx + 10, hipH + 2),
  };
  const fist = fistTarget[pose.arm];
  paint(r.grid, r.mask().stroke([r.at(bx + 10, top - 3), fist], 6.4 * u), "p");
  paint(r.grid, r.mask().ellipse(fist[0], fist[1], 5 * u, 5 * u), "s");
  if (r.weapon === "claw") put(r.grid, fist[0] + 4 * u, fist[1] - 2 * u, ["w", ".", "w"]);
  if (pose.skill) skillAura(r, core, 20 * u);
  if (pose.hurt) impact(r, r.at(bx + 14, top - 2));
};

const drawPlant: Draw = (r, pose) => {
  const { u } = r;
  const sway = [0, 1, 2, -3, 2, 6, 0, -4][["idle_a", "idle_b", "idle_c", "windup", "move", "attack", "recover", "hit"].indexOf(poseName(pose))] ?? 0;
  // 뿌리 덩이
  paint(r.grid, r.mask().ellipse(...r.at(0, 5), 14 * u, 5.5 * u), "s");
  for (const [x, dir] of [[-10, -1], [9, 1], [-3, -1]] as const) {
    paint(r.grid, r.mask().poly([r.at(x, 6), r.at(x + dir * 9, 12 - pose.bob), r.at(x + dir * 3, 8)]), "s");
  }
  const heads: readonly (readonly [number, number, number])[] = [
    // [목 뿌리 x, 머리 x, 머리 높이]
    [-6, -12 + sway * 0.4, 25 - pose.bob + (pose.skill ? 8 : 0)],
    [6, 13 + sway * (pose.arm === 2 ? 1.6 : 0.6), 21 - pose.bob * 0.5 - pose.crouch + (pose.skill ? 9 : 0)],
    [0, 1 + sway * 0.8, 33 - pose.bob + pose.head * 0.6 + (pose.skill ? 4 : 0)],
  ];
  heads.forEach(([root, hx, hh], index) => {
    paint(r.grid, r.mask().stroke([r.at(root, 7), r.at((root + hx) / 2 - 2, (hh + 7) / 2 + 2), r.at(hx - 2, hh - 3)], 3.6 * u), "s");
    const c = r.at(hx, hh);
    const gape = pose.mouth * 3 + (index === 1 && pose.arm === 2 ? 2 : 0);
    paint(r.grid, r.mask().ellipse(c[0], c[1] - 1 * u, 5.5 * u, 3.6 * u + gape * 0.2 * u), "p");
    paint(r.grid, r.mask().poly([[c[0] - 4 * u, c[1] + 1 * u], [c[0] + 7 * u, c[1] + (1 + gape) * u], [c[0] + 3 * u, c[1] + (4 + gape * 0.3) * u], [c[0] - 3 * u, c[1] + 3.5 * u]]), "p");
    put(r.grid, c[0] + 1 * u, c[1] + 0.5 * u, gape > 1.5 ? ["w.w.", "....", ".w.w"] : ["wwww"]);
    eye(r, [c[0], c[1] - 2 * u], pose.hurt);
    if (r.spikes) spike(r, [c[0] - 3 * u, c[1] - 4 * u], [c[0] + 1 * u, c[1] - 4 * u], [c[0] - 3 * u, c[1] - 8 * u]);
  });
  if ((r.weapon === "breath" || pose.skill) && (pose.arm === 2 || pose.skill)) {
    const front = heads[1]!;
    breath(r, r.at(front[1] + 7, front[2] + 1), 12 * u, 3 * u);
  }
  if (pose.skill) skillAura(r, r.at(0, 30), 16 * u);
  if (pose.hurt) impact(r, r.at(14, 26));
};

const drawDragon: Draw = (r, pose) => {
  const { u } = r;
  const bodyH = 16 - pose.crouch * 0.8 - pose.bob * 0.5;
  const bx = pose.lean * 0.4 - 4;
  const st = pose.stride;
  // 먼 날개
  const wingUp = pose.flap * -9 + (pose.skill ? 8 : 0);
  paint(r.grid, r.mask().poly([r.at(bx - 2, bodyH + 9), r.at(bx - 10, bodyH + 24 + wingUp), r.at(bx - 20, bodyH + 20 + wingUp * 0.8), r.at(bx - 14, bodyH + 9)]), "s");
  // 꼬리
  paint(r.grid, r.mask().stroke([r.at(bx - 12, bodyH + 3), r.at(bx - 20, bodyH - 2), r.at(bx - 26, bodyH + 2 + pose.flap * 2), r.at(bx - 28, bodyH + 7 + pose.flap * 2)], 5 * u), "p");
  spike(r, r.at(bx - 29, bodyH + 6), r.at(bx - 26, bodyH + 9), r.at(bx - 30, bodyH + 12));
  leg(r, r.at(bx - 9, bodyH - 1), bx - 13 - st * 4, 0, 5 * u, "p");
  leg(r, r.at(bx + 9, bodyH - 1), bx + 7 + st * 4, 0, 5 * u, "p");
  // 몸통
  paint(r.grid, r.mask().ellipse(...r.at(bx, bodyH + 5), 15 * u, 9 * u), "p");
  paint(r.grid, r.mask().ellipse(...r.at(bx + 3, bodyH + 1.5), 10 * u, 4.5 * u), "s", { outline: false });
  for (const x of [-9, -3, 3]) spike(r, r.at(bx + x - 2, bodyH + 12.5), r.at(bx + x + 2, bodyH + 13), r.at(bx + x - 1, bodyH + 17));
  leg(r, r.at(bx - 6, bodyH), bx - 8 + st * 5, 0, 5.6 * u, "p");
  leg(r, r.at(bx + 11, bodyH), bx + 13 + st * 3 + Math.max(0, pose.lean) * 0.3, 0, 5.6 * u, "p");
  // 목·머리
  const neckLift = pose.skill ? 6 : pose.arm === 1 ? 4 : 0;
  const headC = r.at(bx + 19 + pose.lean * 0.5 - (pose.arm === 1 ? 4 : 0), bodyH + 21 + pose.head * 0.6 + neckLift);
  const neckBase = r.at(bx + 10, bodyH + 9);
  const neckMid: Pt = [(neckBase[0] + headC[0]) / 2 + 2 * u, (neckBase[1] + headC[1]) / 2];
  paint(r.grid, r.mask().stroke([neckBase, neckMid, headC], 6.5 * u), "p");
  paint(r.grid, r.mask().ellipse(headC[0], headC[1], 6 * u, 5 * u), "p");
  const jaw = pose.mouth * 4;
  paint(r.grid, r.mask().poly([[headC[0] + 2 * u, headC[1] - 4 * u], [headC[0] + 11 * u, headC[1] - 2 * u], [headC[0] + 11 * u, headC[1] + 0.5 * u], [headC[0] + 3 * u, headC[1] + 1 * u]]), "p");
  paint(r.grid, r.mask().poly([[headC[0] + 1 * u, headC[1] + 2 * u], [headC[0] + 9 * u, headC[1] + (2 + jaw) * u], [headC[0] + 8 * u, headC[1] + (4 + jaw) * u], [headC[0], headC[1] + 4.5 * u]]), "s");
  if (pose.mouth > 0.3) put(r.grid, headC[0] + 8 * u, headC[1] + 1 * u, ["w.w"]);
  horn(r, [headC[0] - 2 * u, headC[1] - 4 * u], [headC[0] - 9 * u, headC[1] - 9 * u], 2.6 * u);
  if (r.horns) horn(r, [headC[0] + 1 * u, headC[1] - 4.5 * u], [headC[0] - 3 * u, headC[1] - 11 * u], 2 * u);
  eye(r, [headC[0] + 2 * u, headC[1] - 2 * u], pose.hurt, u >= 1.4);
  // 가까운 날개
  paint(r.grid, r.mask().poly([r.at(bx + 1, bodyH + 10), r.at(bx - 4, bodyH + 27 + wingUp), r.at(bx - 16, bodyH + 26 + wingUp * 0.8), r.at(bx - 11, bodyH + 17 + wingUp * 0.4), r.at(bx - 8, bodyH + 10)]), "p");
  paint(r.grid, r.mask().stroke([r.at(bx + 1, bodyH + 10), r.at(bx - 4, bodyH + 27 + wingUp)], Math.max(1.4, 1.6 * u)), "s", { flat: true, outline: false });
  const mouth: Pt = [headC[0] + 11 * u, headC[1] + (1.5 + jaw * 0.5) * u];
  if ((r.weapon === "breath" && pose.arm === 2) || pose.skill) breath(r, mouth, (pose.skill ? 14 : 18) * u, (pose.skill ? 3 : 5) * u);
  if (pose.skill) skillAura(r, r.at(bx, bodyH + 10), 16 * u);
  if (pose.hurt) impact(r, [headC[0] + 6 * u, headC[1] - 6 * u]);
};

const drawWraith: Draw = (r, pose) => {
  const { u } = r;
  const hover = 7 - pose.bob * 0.8 + (pose.skill ? 3 : 0) + (pose.arm === 2 ? -2 : 0);
  const bx = pose.lean * 0.6;
  const top = hover + 34;
  const hem = (k: number): number => hover + (k % 2 ? 3 : 0);
  // 망토 자락(지그재그 밑단)
  const robe: Pt[] = [r.at(bx - 3, top - 4), r.at(bx + 6, top - 6)];
  const hemPoints = [9, 6, 3, 0, -3, -6, -9, -12];
  hemPoints.forEach((x, k) => robe.push(r.at(bx + x - pose.lean * 0.5 - (k * pose.flap) * 0.3, hem(k))));
  robe.push(r.at(bx - 9, top - 9));
  paint(r.grid, r.mask().poly(robe), "p");
  paint(r.grid, r.mask().stroke([r.at(bx + 1, top - 8), r.at(bx + 2, hover + 8)], 2.6 * u), "s", { flat: true, outline: false });
  // 뒤 손(주문 손)
  const castHand = r.at(bx - 9 + (pose.skill ? 2 : 0), top - 14 + (pose.skill ? 10 : pose.arm === 1 ? 6 : 0));
  paint(r.grid, r.mask().stroke([r.at(bx - 5, top - 8), castHand], 3.4 * u), "p");
  put(r.grid, castHand[0] - 1, castHand[1] - 1, ["ww", "w."]);
  // 두건 + 얼굴
  const head = r.at(bx + 2 + pose.lean * 0.3, top + 1 + pose.head * 0.4);
  paint(r.grid, r.mask().poly([[head[0] - 7 * u, head[1] + 6 * u], [head[0] - 3 * u, head[1] - 7 * u], [head[0] + 2 * u, head[1] - 9 * u], [head[0] + 7 * u, head[1] - 2 * u], [head[0] + 6 * u, head[1] + 6 * u]]), "p");
  paint(r.grid, r.mask().ellipse(head[0] + 2 * u, head[1] + 0.5 * u, 3.6 * u, 4 * u), "p", { color: O, outline: false });
  put(r.grid, head[0] + 1 * u, head[1] - 0.5 * u, pose.hurt ? ["o.o"] : ["e.e"]);
  if (r.horns) horn(r, [head[0] - 3 * u, head[1] - 6 * u], [head[0] - 8 * u, head[1] - 12 * u], 2 * u);
  if (r.spikes) spike(r, r.at(bx - 9, top - 9), r.at(bx - 5, top - 5), r.at(bx - 13, top - 3));
  // 앞 손 + 무기
  const armTarget: Record<Pose["arm"], readonly [number, number, number]> = {
    0: [bx + 9, top - 12, -Math.PI / 2.3],
    1: [bx + 2, top - 4, -Math.PI * 0.75],
    2: [bx + 15, top - 10, -Math.PI * 0.08],
    3: [bx + 9, top + 2, -Math.PI / 2],
    4: [bx + 5, top - 14, -Math.PI * 0.62],
  };
  const [ax, ah, angle] = armTarget[pose.arm];
  const hand = r.at(ax, ah);
  if (r.weapon === "claw" || r.weapon === "fang") {
    paint(r.grid, r.mask().stroke([r.at(bx + 4, top - 8), hand], 3.4 * u), "p");
    put(r.grid, hand[0] + 1, hand[1] - 1, ["w.w", ".w.", "w.."]);
  } else {
    heldWeapon(r, hand, angle, r.weapon, pose.skill);
    paint(r.grid, r.mask().stroke([r.at(bx + 4, top - 8), hand], 3.4 * u), "p");
    paint(r.grid, r.mask().ellipse(hand[0], hand[1], 1.8 * u, 1.8 * u), "s", { flat: true });
  }
  if (pose.arm === 2 && (r.weapon === "staff" || r.weapon === "breath")) {
    const tip = r.at(ax + 18 * Math.cos(angle) + 2, ah - 18 * Math.sin(angle));
    breath(r, tip, 10 * u, 3 * u);
  }
  if (pose.skill) {
    paint(r.grid, r.mask().ellipse(castHand[0], castHand[1] - 2 * u, 3.5 * u, 3.5 * u), "a");
    skillAura(r, r.at(bx, top - 10), 17 * u);
  }
  if (pose.hurt) impact(r, r.at(bx + 10, top - 4));
};

const DRAWERS: Readonly<Record<MonsterArchetype, Draw>> = {
  beast: drawBeast,
  "humanoid-knight": drawKnight,
  "winged-fiend": drawFiend,
  "slime-ooze": drawSlime,
  "golem-construct": drawGolem,
  "plant-hydra": drawPlant,
  "dragon-boss": drawDragon,
  "caster-wraith": drawWraith,
};

function poseName(pose: Pose): Exclude<PixelEnemyCell, "dead"> {
  return (Object.keys(POSES) as Exclude<PixelEnemyCell, "dead">[]).find((key) => POSES[key] === pose) ?? "idle_a";
}

// ---------------------------------------------------------------- 마무리(외곽선·기준선·검사)

function bbox(grid: Grid): { minX: number; minY: number; maxX: number; maxY: number } | undefined {
  let minX = grid.size, minY = grid.size, maxX = -1, maxY = -1;
  for (let y = 0; y < grid.size; y += 1) for (let x = 0; x < grid.size; x += 1) {
    if (!grid.get(x, y)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return maxX < 0 ? undefined : { minX, minY, maxX, maxY };
}

/** 4이웃이 하나도 없는 점(다각형 뾰족 끝)을 지우고, 외곽선 없는 테두리에 1px 외곽선을 두른다. */
function finishOutline(grid: Grid): void {
  const size = grid.size;
  const lonely: number[] = [];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    if (grid.get(x, y) && !grid.get(x - 1, y) && !grid.get(x + 1, y) && !grid.get(x, y - 1) && !grid.get(x, y + 1)) lonely.push(y * size + x);
  }
  for (const index of lonely) grid.px[index] = 0;
  const ring: number[] = [];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    if (grid.get(x, y)) continue;
    const near = [grid.get(x - 1, y), grid.get(x + 1, y), grid.get(x, y - 1), grid.get(x, y + 1)];
    if (near.some((c) => c !== 0 && c !== O)) ring.push(y * size + x);
  }
  for (const index of ring) grid.px[index] = O;
}

function shifted(grid: Grid, dx: number, dy: number): Grid {
  if (!dx && !dy) return grid;
  const out = new Grid(grid.size);
  for (let y = 0; y < grid.size; y += 1) for (let x = 0; x < grid.size; x += 1) {
    const c = grid.get(x, y);
    if (c) out.set(x + dx, y + dy, c);
  }
  return out;
}

/** 서 있는 칸은 맨 아래 칠한 줄을 기준선(y=cell−4)에, 나는 칸은 기준선보다 2px 이상 위에 둔다. 좌우는 칸 안으로 민다. */
function settle(grid: Grid, mode: "ground" | "air" | "free"): Grid {
  const box = bbox(grid);
  if (!box) return grid;
  const base = grid.size - 4;
  let dy = 0;
  if (mode === "ground") dy = base - box.maxY;
  else if (mode === "air" && box.maxY > base - 2) dy = base - 2 - box.maxY;
  else if (box.maxY > base) dy = base - box.maxY;
  if (mode !== "ground" && box.minY + dy < 1) dy = 1 - box.minY;
  let dx = 0;
  if (box.minX < 1) dx = 1 - box.minX;
  else if (box.maxX > grid.size - 2) dx = grid.size - 2 - box.maxX;
  return shifted(grid, dx, dy);
}

/** 쓰러진 칸: 맞은 자세를 눕히고(뒤로 넘어짐) 한 단 어둡게. 네발 짐승형은 뒤집힌다. */
function fallen(hit: Grid, kind: "rotate" | "flip"): Grid {
  const box = bbox(hit);
  const out = new Grid(hit.size);
  if (!box) return out;
  const darker: Record<number, number> = { 3: 2, 4: 3, 6: 5, 7: 6, 9: 8, 10: 9, 13: 12, 14: 13, 15: 8, 11: 7 };
  const w = box.maxX - box.minX + 1, h = box.maxY - box.minY + 1;
  for (let y = box.minY; y <= box.maxY; y += 1) for (let x = box.minX; x <= box.maxX; x += 1) {
    const c = hit.get(x, y);
    if (!c) continue;
    const tone = darker[c] ?? c;
    if (kind === "flip") out.set(x, box.maxY - (y - box.minY) + (hit.size - 4 - box.maxY), tone);
    else {
      // 반시계 90° — 머리(위)가 왼쪽(아군 반대편)으로 넘어간다.
      const nx = Math.round(hit.size / 2 - h / 2) + (y - box.minY);
      const ny = hit.size - 4 - (x - box.minX);
      out.set(nx, ny - (w - 1) + (w - 1), tone);
    }
  }
  if (kind === "rotate") {
    // 회전한 높이(원래 너비)가 칸을 넘지 않게 아래 기준으로 다시 맞춘다.
    return settle(out, "ground");
  }
  return out;
}

function gridRows(grid: Grid): string[] {
  const rows: string[] = [];
  for (let y = 0; y < grid.size; y += 1) {
    let row = "";
    for (let x = 0; x < grid.size; x += 1) row += INDEX_CHAR[grid.get(x, y)] ?? ".";
    rows.push(row);
  }
  return rows;
}

function gridFromRows(cell: number, rows: readonly string[], label: string): Grid {
  if (rows.length === 0) throw new MonsterPixelRecipeError(`${label}: 줄이 비었습니다.`);
  if (rows.length > cell) throw new MonsterPixelRecipeError(`${label}: ${rows.length}줄 — 칸(${cell})보다 깁니다.`);
  const width = Math.max(...rows.map((row) => row.length));
  if (width > cell) throw new MonsterPixelRecipeError(`${label}: 가로 ${width}칸 — 칸(${cell})보다 넓습니다.`);
  for (const row of rows) {
    const bad = [...row].find((ch) => !Object.hasOwn(CHAR_INDEX, ch));
    if (bad !== undefined) throw new MonsterPixelRecipeError(`${label}: 모르는 문자 ${JSON.stringify(bad)} — 쓸 수 있는 문자 ${Object.keys(CHAR_INDEX).join("")}`);
  }
  const grid = new Grid(cell);
  const exact = rows.length === cell && width === cell;
  const left = exact ? 0 : Math.floor((cell - width) / 2);
  const top = exact ? 0 : cell - 4 - (rows.length - 1);
  rows.forEach((row, j) => [...row].forEach((ch, i) => grid.set(left + i, top + j, CHAR_INDEX[ch]!)));
  return grid;
}

/** 모드 B 에서 원형 없이 빠진 칸 — 준 칸을 기울이고 줄여 자세를 만든다. */
function derivedCell(source: Grid, cell: PixelEnemyCell, flying: boolean): Grid {
  const box = bbox(source);
  if (!box) return source.clone();
  const size = source.size;
  const out = new Grid(size);
  const height = box.maxY - box.minY + 1;
  const shear = (lean: number, drop: number, lift = 0): void => {
    for (let y = box.minY; y <= box.maxY; y += 1) {
      const fromBottom = box.maxY - y;
      const dx = Math.round((lean * fromBottom) / height);
      // drop: 위쪽 줄을 아래로 눌러 키를 줄인다(숨쉬기).
      const dy = Math.round((drop * fromBottom) / height) - lift;
      for (let x = box.minX; x <= box.maxX; x += 1) {
        const c = source.get(x, y);
        if (c) out.set(x + dx, y + dy, c);
      }
    }
  };
  const recolor = (map: Record<number, number>): void => { for (let i = 0; i < out.px.length; i += 1) out.px[i] = map[out.px[i]!] ?? out.px[i]!; };
  const s = Math.max(1, Math.round(size / 64));
  switch (cell) {
    case "idle_a": shear(0, 0); break;
    case "idle_b": shear(0, s); break;
    case "idle_c": shear(s, 2 * s); break;
    case "windup": shear(-3 * s, 2 * s); break;
    case "move": shear(3 * s, 0, flying ? 0 : s); break;
    case "attack": shear(6 * s, s); break;
    case "recover": {
      shear(-s, -s);
      const top = bbox(out);
      const r: Rig = { grid: out, u: size / 64, cx: size / 2, ground: size - 4, weapon: "staff", spikes: false, horns: false, at: (x, h) => [size / 2 + (x * size) / 64, size - 3 - (h * size) / 64], mask: () => new Mask(size) };
      if (top) skillAura(r, [(top.minX + top.maxX) / 2, (top.minY + top.maxY) / 2], Math.min(size * 0.38, (top.maxX - top.minX) * 0.6 + 4));
      break;
    }
    case "hit": shear(-4 * s, s); recolor({ 2: 3, 3: 4, 5: 6, 6: 7, 12: 13, 13: 14 }); break;
    case "dead": return fallen(source, "rotate");
  }
  return out;
}

function diffCount(a: Grid, b: Grid): number {
  let n = 0;
  for (let i = 0; i < a.px.length; i += 1) if (a.px[i] !== b.px[i]) n += 1;
  return n;
}

// ---------------------------------------------------------------- 진입점

export interface ResolvedMonsterRecipe {
  readonly name: string;
  readonly archetype: MonsterArchetype | undefined;
  readonly weapon: MonsterWeapon;
  readonly cell: MonsterSheetCell;
  readonly motion: PixelEnemyMotion;
  readonly idleFrameMs: number;
  readonly flying: boolean;
}

export function resolveMonsterRecipe(recipe: MonsterPixelRecipe): ResolvedMonsterRecipe {
  const archetype = recipe.archetype;
  if (archetype !== undefined && !MONSTER_ARCHETYPES.includes(archetype)) {
    throw new MonsterPixelRecipeError(`archetype 은 ${MONSTER_ARCHETYPES.join(" | ")} 중 하나입니다: ${JSON.stringify(archetype)}`);
  }
  if (!archetype && !recipe.cells?.idle_a) {
    throw new MonsterPixelRecipeError("archetype 을 고르거나 cells.idle_a 격자를 주세요(모드 B 는 대기 a 칸이 바탕입니다).");
  }
  const defaults = ARCHETYPE_DEFAULTS[archetype ?? "humanoid-knight"];
  const weapon = recipe.weapon ?? defaults.weapon;
  if (!MONSTER_WEAPONS.includes(weapon)) throw new MonsterPixelRecipeError(`weapon 은 ${MONSTER_WEAPONS.join(" | ")} 중 하나입니다.`);
  const cell = recipe.cell ?? (recipe.cells?.idle_a ? (recipe.cells.idle_a.length > 64 ? 96 : recipe.cells.idle_a.length > 48 ? 64 : 48) : defaults.cell);
  if (!MONSTER_SHEET_CELLS.includes(cell)) throw new MonsterPixelRecipeError("cell 은 48 | 64 | 96 입니다.");
  const motion = recipe.motion ?? defaults.motion;
  if (!MONSTER_MOTIONS.includes(motion)) throw new MonsterPixelRecipeError(`motion 은 ${MONSTER_MOTIONS.join(" | ")} 중 하나입니다.`);
  return {
    name: recipe.name?.trim() || (archetype ? MONSTER_ARCHETYPE_LABELS[archetype] : "도트 몬스터"),
    archetype,
    weapon,
    cell,
    motion,
    idleFrameMs: defaults.idleFrameMs,
    flying: archetype ? defaults.flying : motion === "float" || motion === "swoop",
  };
}

function composeFrames(recipe: MonsterPixelRecipe, resolved: ResolvedMonsterRecipe, scale: number): {
  frames: Record<PixelEnemyCell, Grid>;
  bounds: Record<PixelEnemyCell, MonsterCellBounds>;
  errors: string[];
} {
  const { cell, archetype, weapon, flying } = resolved;
  const custom = recipe.cells ?? {};
  const frames = {} as Record<PixelEnemyCell, Grid>;
  const customBase = custom.idle_a ? gridFromRows(cell, custom.idle_a, "cells.idle_a") : undefined;
  for (const name of MONSTER_SHEET_ORDER) {
    const rows = custom[name];
    if (rows) { frames[name] = gridFromRows(cell, rows, `cells.${name}`); continue; }
    if (name === "dead") continue;
    if (archetype) {
      const rig = makeRig(cell, recipe, weapon, archetype, scale);
      DRAWERS[archetype](rig, POSES[name]);
      frames[name] = rig.grid;
    } else {
      frames[name] = derivedCell(customBase!, name, flying);
    }
  }
  for (const name of MONSTER_SHEET_ORDER) if (name !== "dead") finishOutline(frames[name]);
  if (!custom.dead) {
    const flips = archetype === "beast" || archetype === "dragon-boss";
    const dead = archetype === "slime-ooze" ? puddle(cell) : archetype ? fallen(frames.hit, flips ? "flip" : "rotate") : derivedCell(customBase!, "dead", flying);
    finishOutline(dead);
    frames.dead = dead;
  } else finishOutline(frames.dead);

  const errors: string[] = [];
  const bounds = {} as Record<PixelEnemyCell, MonsterCellBounds>;
  for (const name of MONSTER_SHEET_ORDER) {
    const mode = name === "dead" ? "ground" : name === "move" ? (flying ? "air" : "free") : flying ? "air" : "ground";
    frames[name] = settle(frames[name], mode);
    const box = bbox(frames[name]);
    if (!box) { errors.push(`${name}: 빈 칸`); bounds[name] = { x: 0, y: 0, width: 0, height: 0, bottom: 0 }; continue; }
    bounds[name] = { x: box.minX, y: box.minY, width: box.maxX - box.minX + 1, height: box.maxY - box.minY + 1, bottom: box.maxY };
    if (box.minX < 1 || box.minY < 1 || box.maxX > cell - 2) errors.push(`${name}: 칸 가장자리에 닿음 ${JSON.stringify(bounds[name])}`);
    if (box.maxY > cell - 4) errors.push(`${name}: 기준선(y=${cell - 4}) 아래로 내려감`);
    if (mode === "ground" && box.maxY !== cell - 4) errors.push(`${name}: 발이 기준선에 닿지 않음(bottom=${box.maxY})`);
  }
  return { frames, bounds, errors };
}

/** 9칸 시트 + 초상 PNG 를 만든다. 인자가 틀리면 MonsterPixelRecipeError. */
export function generateMonsterPixelSheet(recipe: MonsterPixelRecipe): MonsterPixelSheet {
  const resolved = resolveMonsterRecipe(recipe);
  const { cell, archetype, weapon, flying } = resolved;
  const palette = buildPalette(recipe);
  // 원형 리그는 무기·날개가 칸 밖으로 나가면 몸 전체를 줄여 다시 그린다(칸마다 따로 줄이면 몸 크기가 튄다).
  let composed = composeFrames(recipe, resolved, 1);
  for (let scale = 0.92; archetype && composed.errors.length > 0 && scale >= 0.7; scale -= 0.06) {
    composed = composeFrames(recipe, resolved, scale);
  }
  const { frames, bounds, errors } = composed;
  let minPair = { pixels: Number.POSITIVE_INFINITY, cells: ["idle_a", "idle_b"] as [PixelEnemyCell, PixelEnemyCell] };
  for (let i = 0; i < MONSTER_SHEET_ORDER.length; i += 1) for (let j = i + 1; j < MONSTER_SHEET_ORDER.length; j += 1) {
    const a = MONSTER_SHEET_ORDER[i]!, b = MONSTER_SHEET_ORDER[j]!;
    const d = diffCount(frames[a], frames[b]);
    if (d === 0) errors.push(`${a} 와 ${b} 가 같은 그림`);
    if (d < minPair.pixels) minPair = { pixels: d, cells: [a, b] };
  }

  const used = new Set<number>();
  const sheet = new Uint8Array(cell * 3 * cell * 3);
  MONSTER_SHEET_ORDER.forEach((name, index) => {
    const ox = (index % 3) * cell, oy = Math.floor(index / 3) * cell;
    const grid = frames[name];
    for (let y = 0; y < cell; y += 1) for (let x = 0; x < cell; x += 1) {
      const c = grid.get(x, y);
      if (c) used.add(c);
      sheet[(oy + y) * cell * 3 + ox + x] = c;
    }
  });
  const sheetPng = encodeIndexedPng({ width: cell * 3, height: cell * 3, pixels: sheet, palette });
  const portraitPng = encodeIndexedPng({ width: cell, height: cell, pixels: frames.idle_a.px, palette });
  const rows = {} as Record<PixelEnemyCell, readonly string[]>;
  for (const name of MONSTER_SHEET_ORDER) rows[name] = gridRows(frames[name]);
  return {
    name: resolved.name,
    archetype: archetype ?? "custom",
    weapon,
    cell,
    motion: resolved.motion,
    idleFrameMs: resolved.idleFrameMs,
    flying,
    sheetDataUrl: pngDataUrl(sheetPng),
    portraitDataUrl: pngDataUrl(portraitPng),
    bounds,
    colors: used.size,
    minPairDiff: minPair,
    palette: Object.fromEntries(INDEX_CHAR.slice(1).map((ch, index) => [ch, hexOf(palette[index + 1]!)])),
    errors,
    rows,
  };
}

/** 슬라임 쓰러짐 — 납작한 웅덩이와 거품 두 알. */
function puddle(cell: number): Grid {
  const grid = new Grid(cell);
  const u = cell / 64;
  const ground = cell - 4;
  const m = new Mask(cell).ellipse(cell / 2, ground - 2 * u, 20 * u, 3.5 * u);
  for (let y = ground + 1; y < cell; y += 1) for (let x = 0; x < cell; x += 1) m.on[y * cell + x] = 0;
  paint(grid, m, "p");
  paint(grid, new Mask(cell).ellipse(cell / 2 + 8 * u, ground - 7 * u, 2 * u, 2 * u), "p");
  paint(grid, new Mask(cell).ellipse(cell / 2 - 10 * u, ground - 9 * u, 1.5 * u, 1.5 * u), "a");
  put(grid, cell / 2 - 2 * u, ground - 3 * u, ["o.o"]);
  return grid;
}
