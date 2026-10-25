/**
 * 『아스트라 호라이즌』 타이틀 앞 인트로 — 포켓몬 3세대(루비·사파이어·에메랄드, 파이어레드·리프그린) 결의 짧고 밝은 인트로.
 *
 * 2026-10-25 사용자 반려: 밤하늘·별·달을 가르는 전설 실루엣은 다른 데모(『폴른 스타』)와 너무 닮았다 → 맑은 들판에서 다시.
 *   1) 맑은 들판(3.6초): 스타터 셋이 왼쪽에서 달려 들어와 차례로 깡충 뛴다.
 *   2) 인사(2초): 셋의 정면 그림이 줄지어 튀어 올라 하트·느낌표를 띄운다.
 *   3) 로고(3초): 같은 들판 위로 로고가 통통 튀며 박히고 반짝인다. 하얀 섬광으로 타이틀(같은 들판 그림)에 넘긴다.
 * 모두 8.6초. 아무 키나 누르면 타이틀로 간다. 엔진 기능만 쓴다(시트 걷기·크기 키·말풍선·입자·효과음 큐).
 * 새 화소 없음 — 배경은 타이틀 키아트(oprn_emerald_title_meadow, 240×160 을 정확히 2배), 몬스터는 게임 속 종의 정면 그림·필드 칩 그대로다.
 */
import { charsetPatternIndex } from "@/project/emeraldMonsterOpeningShots";
import { MONSTER_TITLE_ART_IDS } from "@/project/emeraldMonsterTitleArt";
import { validateOpeningAnimatic, type AnimaticKey, type AnimaticLayer, type OpeningAnimatic } from "@/project/openingAnimatic";
import type { CinematicSequence, Project } from "@/project/types";

const STAGE = { width: 480, height: 320 } as const;
const MEADOW = MONSTER_TITLE_ART_IDS.default;

const SE = {
  pop: "cc0-se-ors-item-gem-02",
  logo: "cc0-sound-monster-item-get",
  confirm: "cc0-sound-monster-ui-confirm",
  cries: ["cc0-se-ors-creature-misc-01", "cc0-se-ors-creature-misc-02", "cc0-se-ors-creature-misc-03"],
} as const;

/** 스타터 셋(풀·불꽃·물)의 정면 그림·필드 칩 — 데모 프로젝트의 실제 종 그림. */
export type AstraIntroCast = {
  readonly starters: readonly { readonly front: string; readonly chip?: { readonly resourceId: string; readonly index: number } }[];
};

const key = (atMs: number, value: number, ease?: AnimaticKey["ease"]): AnimaticKey => (ease ? { atMs, value, ease } : { atMs, value });
const CELL = { w: 24, h: 32 } as const;
const CHIP_SCALE = 2;

const meadow = (extra: Partial<AnimaticLayer> = {}): AnimaticLayer =>
  ({ id: "meadow", kind: "image", role: "background", resourceId: MEADOW, sampling: "nearest", x: 0, y: 0, width: STAGE.width, height: STAGE.height, ...extra });

const shot = (layers: AnimaticLayer[], transition: OpeningAnimatic["transition"], audioCues: OpeningAnimatic["audioCues"] = []): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background: "#9fd8ff", upscale: "nearest", layers, ...(transition ? { transition } : {}), ...(audioCues.length ? { audioCues } : {}) });

/** 걷는 칩의 시트 칸(오른쪽 보기 행) — 서기·오른발·서기·왼발. */
function rightWalkFrames(index: number): number[] {
  const row = Math.floor(index / 4) * 4 + 1, base = row * 12 + (index % 4) * 3;
  return [base + 1, base + 2, base + 1, base];
}

// ── 1. 맑은 들판 ────────────────────────────────────────────────────────
/** 스타터 셋이 왼쪽에서 달려 들어와 풀밭 가운데에 줄지어 서고, 차례로 깡충 뛴다. */
function meadowShot(cast: AstraIntroCast): OpeningAnimatic {
  const foot = 292, w = CELL.w * CHIP_SCALE, h = CELL.h * CHIP_SCALE, top = foot - h;
  const runners = cast.starters.slice(0, 3).flatMap((starter, i): AnimaticLayer[] => {
    if (!starter.chip) return [];
    const startX = -60 - i * 64, endX = 268 - i * 72, arrive = 2100 + i * 120, hop = 2400 + i * 160;
    return [{
      id: `runner-${i}`, kind: "image", role: "actor", characterRole: "monster", resourceId: starter.chip.resourceId, sampling: "nearest",
      sheet: { frameWidth: CELL.w, frameHeight: CELL.h, columns: 12, count: 96, fps: 0 }, x: startX, y: top, width: w, height: h,
      walk: { stride: 10, frames: rightWalkFrames(starter.chip.index) },
      keys: { x: [key(0, startX), key(arrive, endX, "ease-out")], y: [key(0, top), key(hop, top), key(hop + 150, top - 18, "ease-out"), key(hop + 300, top, "ease-in")] },
    }, {
      id: `dust-${i}`, kind: "particles", role: "effect", color: "#f4e8c8", opacity: 0.55, x: startX + 10, y: foot - 12, width: 36, height: 14, endMs: arrive + 200,
      particles: { preset: "dust", count: 8, seed: 40 + i, speed: 14, size: 2 }, keys: { x: [key(0, startX + 10), key(arrive, endX + 10, "ease-out")] },
    }];
  });
  return shot([
    meadow(),
    { id: "sparkle", kind: "particles", role: "effect", color: "#ffffff", blend: "lighter", opacity: 0.6, x: 0, y: 0, width: STAGE.width, height: 180, particles: { preset: "sparks", count: 18, seed: 5, speed: 6, size: 1.2 } },
    ...runners,
    // 첫 장면은 하얗게 밝아지며 열린다.
    { id: "open", kind: "shape", shape: "rect", role: "effect", space: "screen", color: "#ffffff", x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity: 1, keys: { opacity: [key(0, 1), key(500, 0, "ease-out")] } },
  ], { kind: "cut", durationMs: 1 }, cast.starters.slice(0, 3).map((_, i) => ({ id: `cry-${i}`, resourceId: SE.cries[i]!, atMs: 2400 + i * 160, durationMs: 700, volume: 0.5 })));
}

// ── 2. 인사 ─────────────────────────────────────────────────────────────
/** 셋의 정면 그림이 차례로 튀어 올라 눌렸다 펴지고, 하트·느낌표·하트를 띄운다. */
function helloShot(cast: AstraIntroCast): OpeningAnimatic {
  const size = 128, floor = 268, xs = [120, 240, 360];
  const pops = cast.starters.slice(0, 3).flatMap((starter, i): AnimaticLayer[] => {
    const at = 120 + i * 220, x = xs[i]!;
    return [
      { id: `shadow-${i}`, kind: "shape", shape: "ellipse", role: "prop", color: "#2a4a2a", x: x - 34, y: floor - 8, width: 68, height: 12, opacity: 0.3, startMs: at },
      { id: `front-${i}`, kind: "image", role: "actor", characterRole: "monster", resourceId: starter.front, sampling: "nearest", x, y: floor, width: size, height: size, anchorX: 0.5, anchorY: 1, startMs: at,
        keys: {
          y: [key(at, floor + 40), key(at + 180, floor - 24, "ease-out"), key(at + 330, floor, "ease-in")],
          scaleX: [key(at, 0.4), key(at + 180, 0.95), key(at + 330, 1.16, "ease-out"), key(at + 470, 1, "ease-in-out")],
          scaleY: [key(at, 0.4), key(at + 180, 1.1), key(at + 330, 0.84, "ease-out"), key(at + 470, 1, "ease-in-out")],
        } },
      { id: `emote-${i}`, kind: "emote", role: "effect", x: x + 18, y: floor - size + 10, width: 30, height: 30, startMs: at + 480, endMs: 2000, emote: { preset: i === 1 ? "exclaim" : "heart", tail: "down", popMs: 140 } },
    ];
  });
  return shot([
    meadow({ x: 0 }),
    { id: "soft", kind: "shape", shape: "rect", role: "effect", space: "screen", color: "#ffffff", x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity: 0.28 },
    ...pops,
  ], { kind: "wipe-left", durationMs: 250, color: "#ffffff" }, cast.starters.slice(0, 3).map((_, i) => ({ id: `pop-${i}`, resourceId: SE.pop, atMs: 120 + i * 220, durationMs: 700, volume: 0.5 })));
}

// ── 3. 로고 ─────────────────────────────────────────────────────────────
/** 같은 들판 위로 로고가 통통 튀며 박힌다(작게 → 1.15배 → 1배). 부제가 뜨고 반짝인다. 하얀 섬광으로 타이틀에 넘긴다. */
function logoShot(): OpeningAnimatic {
  const ms = 3000, logoY = 96, at = 150;
  const bounce = (): Pick<NonNullable<AnimaticLayer["keys"]>, "scaleX" | "scaleY"> => ({
    scaleX: [key(at, 0.1), key(at + 260, 1.15, "ease-out"), key(at + 420, 0.96, "ease-in-out"), key(at + 560, 1, "ease-in-out")],
    scaleY: [key(at, 0.1), key(at + 260, 1.15, "ease-out"), key(at + 420, 0.96, "ease-in-out"), key(at + 560, 1, "ease-in-out")],
  });
  const logo = (id: string, color: string, dx: number, dy: number): AnimaticLayer => ({
    id, kind: "text", role: "credit", space: "screen", text: "아스트라 호라이즌", color, x: 240 + dx, y: logoY + dy, width: 470, height: 64, anchorX: 0.5, anchorY: 0,
    typography: { fontSize: 46, weight: 900, align: "center" }, startMs: at, keys: bounce(),
  });
  return shot([
    meadow(),
    { id: "soft", kind: "shape", shape: "rect", role: "effect", space: "screen", color: "#ffffff", x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity: 0.18 },
    logo("logo-shadow", "#23406e", 3, 4),
    logo("logo", "#ffd23f", 0, 0),
    { id: "subtitle", kind: "text", role: "credit", space: "screen", text: "다우닝 시티와 여명의 날개", color: "#ffffff", x: 0, y: logoY + 66, width: STAGE.width, height: 24,
      typography: { fontSize: 17, weight: 800, align: "center" }, startMs: 700, keys: { opacity: [key(700, 0), key(1100, 1, "ease-out")] } },
    { id: "sparks", kind: "particles", role: "effect", space: "screen", color: "#fff6b0", blend: "lighter", x: 60, y: logoY - 10, width: 360, height: 100, startMs: at + 200,
      particles: { preset: "sparks", count: 36, seed: 61, speed: 14, size: 1.6 }, keys: { opacity: [key(at + 200, 1), key(ms, 0.4)] } },
    { id: "out", kind: "shape", shape: "rect", role: "effect", space: "screen", color: "#ffffff", x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity: 0, keys: { opacity: [key(0, 0), key(ms - 300, 0), key(ms, 1, "ease-in")] } },
  ], { kind: "flash", durationMs: 250, color: "#ffffff" }, [
    { id: "logo", resourceId: SE.logo, atMs: at, durationMs: 1400, volume: 0.6 },
    { id: "out", resourceId: SE.confirm, atMs: ms - 400, durationMs: 400, volume: 0.45 },
  ]);
}

const SHOTS: readonly { id: string; ms: number; build: (cast: AstraIntroCast) => OpeningAnimatic }[] = [
  { id: "astra_intro_meadow", ms: 3600, build: meadowShot },
  { id: "astra_intro_hello", ms: 2000, build: helloShot },
  { id: "astra_intro_logo", ms: 3000, build: logoShot },
];

/** 스타터 셋(풀·불꽃·물)의 정면 그림·필드 칩 — 데모 프로젝트의 실제 종 그림. */
export function astraIntroCast(project: Project): AstraIntroCast {
  const species = project.database.monsterSpecies ?? [];
  const starters = ["grass", "fire", "water"].flatMap(type => {
    const row = species.find(s => s.types?.includes(type));
    const front = row?.graphic.monsterResourceId;
    if (!row || !front) return [];
    const field = row.graphic.fieldGraphic;
    return [{ front, ...(field?.sprite?.id ? { chip: { resourceId: field.sprite.id, index: charsetPatternIndex(field.pattern ?? 0) } } : {}) }];
  });
  return { starters };
}

/** 인트로 컷들(검증 포함). 테스트·도구가 프로젝트 없이 컷을 볼 수 있게 따로 둔다. */
export function astraTitleIntroScenes(cast: AstraIntroCast): CinematicSequence["scenes"] {
  return SHOTS.map(({ id, ms, build }) => {
    const composition = build(cast);
    validateOpeningAnimatic(composition, ms, `titleIntro.${id}`);
    return { id, kind: "animatic" as const, composition, durationMs: ms, narration: "" };
  });
}

/** system.titleIntro 를 짓는다. 음악 없이 효과음으로 간다 — 타이틀 곡이 깨끗하게 시작된다. 기존 opening(새 게임 뒤 박사 소개)은 건드리지 않는다. */
export function buildAstraTitleIntro(project: Project): CinematicSequence {
  const sequence: CinematicSequence = { enabled: true, skippable: true, scenes: astraTitleIntroScenes(astraIntroCast(project)) };
  project.system.titleIntro = sequence;
  return sequence;
}
